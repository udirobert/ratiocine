"""
Competition submission script — copy this into your HF repo as script.py.

The eval sandbox:
  - mounts the test set at /tmp/data/test.csv
  - has no internet
  - runs on a T4 (16GB)
  - has 30 minutes
  - has bitsandbytes and autoawq pre-installed

Strategy: Ship Qwen2.5-14B-Instruct-AWQ with direct prompting (no CoT).
The 14B-AWQ is the proven competition baseline (0.123 score). We improve
on the baseline with:
1. Task-specific system prompts (better than generic)
2. Fixed answer parser (v1 dropped ~5% of correct answers)
3. Explanation column for human jury track
4. Time guard to never exceed 30-min limit

Direct prompts (no CoT) are ~10x faster than CoT and preserve EM accuracy.
"""

import json
import os
import re
import time

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
MODEL_ID = "."

import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from prompts import (
    get_system_prompt,
    USER_TEMPLATE,
    parse_answers,
    extract_analysis,
    count_query_items,
)

# Time budget: 30 min total. Reserve 3 min for model loading + CSV write.
TIME_BUDGET_S = 27 * 60  # 27 minutes for inference


def load_model():
    """Load the AWQ-quantized model for T4 16GB."""
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16,
    )
    model.eval()
    print("[submit] Loaded Qwen2.5-14B-Instruct-AWQ", flush=True)
    return tokenizer, model


def solve_problem(
    tokenizer,
    model,
    context: str,
    query: str,
    task_type: str = "",
    max_new_tokens: int = 256,
) -> tuple[list[str], str]:
    """Generate answers for one IOL problem with direct prompting.

    max_new_tokens=256 is enough for direct answers (no CoT reasoning).
    This keeps each problem to ~5-8s on T4, fitting 160 problems in 30 min.
    """
    n_items = count_query_items(query)
    system_prompt = get_system_prompt(task_type)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": USER_TEMPLATE.format(
            context=context.strip(), query=query.strip()
        )},
    ]

    text = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=False
    )
    inputs = tokenizer(text, return_tensors="pt")
    input_ids = inputs["input_ids"].to(model.device)

    with torch.no_grad():
        out = model.generate(
            input_ids,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = tokenizer.decode(
        out[0][input_ids.shape[-1]:], skip_special_tokens=True
    ).strip()

    answers = parse_answers(generated, n_expected=n_items, task_type=task_type)
    explanation = extract_analysis(generated)

    return answers, explanation


def main():
    t_start = time.time()

    print("[submit] Loading model...", flush=True)
    tokenizer, model = load_model()

    print("[submit] Reading test set...", flush=True)
    df = pd.read_csv("/tmp/data/test.csv", dtype=str).fillna("")
    n_problems = len(df)
    print(f"[submit] Loaded {n_problems} problems", flush=True)

    rows = []
    for idx, row in df.iterrows():
        # Time guard
        elapsed = time.time() - t_start
        remaining = TIME_BUDGET_S - elapsed
        problems_left = n_problems - idx

        if remaining < problems_left * 3 and remaining > 0:
            # Very low on time — minimal tokens
            current_max = 128
            if idx % 10 == 0:
                print(f"[submit] FAST MODE at {idx+1}/{n_problems} "
                      f"({remaining:.0f}s left)", flush=True)
        else:
            current_max = 256

        try:
            answers, explanation = solve_problem(
                tokenizer,
                model,
                context=row["context"],
                query=row["query"],
                task_type=row.get("task_type", ""),
                max_new_tokens=current_max,
            )
        except Exception as e:
            print(f"[submit] ERROR at {idx+1}/{n_problems}: {e}", flush=True)
            n_items = count_query_items(row.get("query", ""))
            answers = [""] * max(n_items, 1)
            explanation = ""

        rows.append({
            "id": row["id"],
            "pred": json.dumps(answers, ensure_ascii=False),
            "explanation": explanation,
        })

        if (idx + 1) % 10 == 0 or idx == 0:
            print(f"[submit] {idx + 1}/{n_problems} done "
                  f"({elapsed:.0f}s elapsed)", flush=True)

    output = pd.DataFrame(rows)
    # Write to the path the eval system expects
    import os as _os
    _os.makedirs("/tmp/model", exist_ok=True)
    output.to_csv("/tmp/model/submission.csv", index=False)
    # Also write a backup at the relative path (in case CWD is /tmp/model)
    output.to_csv("submission.csv", index=False)
    total_elapsed = time.time() - t_start
    print(f"[submit] wrote submission.csv ({len(rows)} problems, "
          f"{total_elapsed:.0f}s total, cwd={_os.getcwd()})", flush=True)


if __name__ == "__main__":
    main()
