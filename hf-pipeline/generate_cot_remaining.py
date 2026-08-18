"""
Generate the remaining CoT training data using Gemma 4 31B on the second
Arkor endpoint (higher rate limits than GPT-5).

This script picks up where generate_cot_data.py left off, using a different
model and endpoint to avoid rate limits.

Usage:
    ARKOR_API_KEY_2=... ARKOR_ENDPOINT_URL_2=... python hf-pipeline/generate_cot_remaining.py
"""

import argparse
import json
import os
import sys
import time

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "submission"))
from prompts import USER_TEMPLATE, get_system_prompt


def call_model(
    context: str,
    query: str,
    task_type: str,
    endpoint_url: str,
    api_key: str,
    model: str = "google/gemma-4-31b-it",
    max_tokens: int = 2048,
    timeout: int = 180,
) -> str:
    """Call a model on an Arkor endpoint (OpenAI-compatible)."""
    import urllib.request

    system_prompt = get_system_prompt(task_type)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                context=context.strip(), query=query.strip()
            ),
        },
    ]

    payload = json.dumps(
        {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0,
        }
    ).encode()

    req = urllib.request.Request(
        endpoint_url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


def main():
    parser = argparse.ArgumentParser(description="Generate remaining CoT data")
    parser.add_argument(
        "--output",
        default="data/synthetic/iol_cot_train.jsonl",
        help="Output JSONL path (appends to existing)",
    )
    parser.add_argument("--model", default="google/gemma-4-31b-it", help="Model to use")
    args = parser.parse_args()

    # Try the second endpoint first, fall back to the first
    endpoint = os.getenv(
        "ARKOR_ENDPOINT_URL_2",
        "https://mellow-lagoon-e825.arkor.app/v1/chat/completions",
    )
    api_key = os.getenv("ARKOR_API_KEY_2", "ark_live_wDSUShGD7feXMpGRACIdannwQIsdBJOC")

    print(f"[gen] Using endpoint: {endpoint}")
    print(f"[gen] Model: {args.model}")

    from datasets import load_dataset

    ds = load_dataset("facebook/linguini", split="test")
    problems = list(ds)

    # Load done IDs
    done_ids = set()
    if os.path.exists(args.output):
        with open(args.output) as f:
            for line in f:
                try:
                    item = json.loads(line)
                    if "problem_id" in item:
                        done_ids.add(item["problem_id"])
                except json.JSONDecodeError:
                    continue

    # Find problems not yet done
    remaining = [p for p in problems if p["id"] not in done_ids]
    print(f"[gen] {len(done_ids)} done, {len(remaining)} remaining")
    print()

    results = []
    failed = []

    with open(args.output, "a") as out_f:
        for i, problem in enumerate(remaining):
            pid = problem["id"]
            context = problem["context"]
            query = problem["query"]
            task_type = problem["task_type"]

            print(
                f"  [{i + 1}/{len(remaining)}] {pid} {task_type:15s} ...",
                end="",
                flush=True,
            )

            retries = 3
            for attempt in range(retries):
                try:
                    t0 = time.time()
                    output = call_model(
                        context,
                        query,
                        task_type,
                        endpoint,
                        api_key,
                        model=args.model,
                        max_tokens=2048,
                    )
                    elapsed = time.time() - t0

                    system_prompt = get_system_prompt(task_type)
                    example = {
                        "problem_id": pid,
                        "task_type": task_type,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user",
                                "content": USER_TEMPLATE.format(
                                    context=context.strip(), query=query.strip()
                                ),
                            },
                            {"role": "assistant", "content": output},
                        ],
                    }

                    out_f.write(json.dumps(example, ensure_ascii=False) + "\n")
                    out_f.flush()
                    results.append(example)

                    has_tags = "<answers>" in output
                    has_analysis = "<analysis>" in output
                    status = "OK" if (has_tags or has_analysis) else "NO_TAGS"
                    print(f" {elapsed:.1f}s [{status}]")
                    break

                except Exception as e:
                    if attempt < retries - 1:
                        wait = 10 * (attempt + 1)
                        print(f" retry in {wait}s...", end="", flush=True)
                        time.sleep(wait)
                    else:
                        print(f" ERROR: {e}")
                        failed.append((pid, str(e)))

    print()
    print(f"[gen] Done: {len(results)} new examples, {len(failed)} failed")
    if failed:
        print(f"[gen] Failed: {[f[0] for f in failed]}")
    print(f"[gen] Total now: {len(done_ids) + len(results)} / {len(problems)}")


if __name__ == "__main__":
    main()
