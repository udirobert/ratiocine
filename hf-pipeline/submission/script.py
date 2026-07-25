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
import re

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
MODEL_ID = "."

import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

from prompts import get_system_prompt, USER_TEMPLATE, parse_answers, count_query_items


def load_model():
    """Load the model with quantization for T4 16GB.

    Tries AWQ first (faster, better quality), falls back to bitsandbytes 4-bit.
    """
    # Try AWQ quantized model (pre-installed on eval T4 via autoawq)
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            torch_dtype=torch.float16,
            trust_remote_code=True,
        )
        model.eval()
        print("[submit] Loaded model (AWQ/native)", flush=True)
        return tokenizer, model
    except Exception as awq_err:
        print(f"[submit] AWQ load failed ({awq_err}), trying bitsandbytes 4-bit...", flush=True)

    # Fallback: bitsandbytes 4-bit
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
    )
    model.eval()
    print("[submit] Loaded model (bitsandbytes 4-bit)", flush=True)

    return tokenizer, model


def solve_problem(
    tokenizer,
    model,
    context: str,
    query: str,
    task_type: str = "",
    max_new_tokens: int = 512,
) -> list[str]:
    """Generate answers for one IOL problem with task-specific prompting.

    max_new_tokens=512 keeps inference fast enough for the 30-min T4 limit
    across ~160 problems (~2-3s per problem for short answers).
    """
    n_items = count_query_items(query)
    system_prompt = get_system_prompt(task_type)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": USER_TEMPLATE.format(
            context=context.strip(), query=query.strip()
        )},
    ]

    ids = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt"
    )
    # Ensure we get a raw tensor, not BatchEncoding
    if hasattr(ids, "input_ids"):
        ids = ids.input_ids
    ids = ids.to(model.device)

    with torch.no_grad():
        out = model.generate(
            ids,
            max_new_tokens=max_new_tokens,
            do_sample=False,  # greedy decoding for reproducibility
            temperature=1.0,  # ignored with do_sample=False but avoids warnings
            pad_token_id=tokenizer.eos_token_id,
        )

    text = tokenizer.decode(out[0][ids.shape[-1] :], skip_special_tokens=True).strip()
    answers = parse_answers(text, n_expected=n_items, task_type=task_type)

    return answers


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
            task_type=row.get("task_type", ""),
        )
        rows.append({
            "id": row["id"],
            "pred": json.dumps(answers, ensure_ascii=False),
        })

        if (idx + 1) % 5 == 0 or idx == 0:
            print(f"[submit] {idx + 1}/{len(df)} done", flush=True)

    output = pd.DataFrame(rows)
    output.to_csv("submission.csv", index=False)
    print(f"[submit] wrote submission.csv ({len(rows)} problems)", flush=True)


if __name__ == "__main__":
    main()
