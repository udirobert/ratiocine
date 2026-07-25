"""
Competition submission script — copy this into your HF repo as script.py.

The eval sandbox:
  - mounts the test set at /tmp/data/test.csv
  - has no internet
  - runs on a T4 (16GB)
  - has 30 minutes
  - has bitsandbytes and autoawq pre-installed

Ship your fine-tuned model weights in the same HF repo and load from ".".
"""

import json
import os

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
MODEL_ID = "."

import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

SYSTEM_PROMPT = (
    "You solve International Linguistics Olympiad problems. "
    "Answer every numbered item. Put each answer on its own line, "
    "in order, with no numbering and no extra text."
)


def load_model():
    """Load the fine-tuned model with 4-bit quantization."""
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.float16,
    )
    model.eval()

    return tokenizer, model


def solve_problem(
    tokenizer,
    model,
    context: str,
    query: str,
    max_new_tokens: int = 512,
) -> list[str]:
    """Generate answers for one IOL problem."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{context}\n\n{query}"},
    ]

    ids = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt"
    ).to(model.device)

    with torch.no_grad():
        out = model.generate(
            ids,
            max_new_tokens=max_new_tokens,
            do_sample=False,  # greedy decoding for reproducibility
        )

    text = tokenizer.decode(out[0][ids.shape[-1] :], skip_special_tokens=True).strip()
    answers = [ln.strip() for ln in text.splitlines() if ln.strip()]

    return answers if answers else [""]


def main():
    print("[submit] Loading model...", flush=True)
    tokenizer, model = load_model()

    print("[submit] Reading test set...", flush=True)
    df = pd.read_csv("/tmp/data/test.csv", dtype=str).fillna("")
    print(f"[submit] Loaded {len(df)} problems", flush=True)

    rows = []
    for idx, row in df.iterrows():
        answers = solve_problem(
            tokenizer,
            model,
            context=row["context"],
            query=row["query"],
        )
        rows.append({
            "id": row["id"],
            "pred": json.dumps(answers, ensure_ascii=False),
        })

        if (idx + 1) % 5 == 0:
            print(f"[submit] {idx + 1}/{len(df)} done", flush=True)

    output = pd.DataFrame(rows)
    output.to_csv("submission.csv", index=False)
    print(f"[submit] wrote submission.csv ({len(rows)} problems)", flush=True)


if __name__ == "__main__":
    main()
