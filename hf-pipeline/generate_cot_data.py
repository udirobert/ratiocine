"""
Generate chain-of-thought training data using GPT-5 on the Arkor endpoint.

For each Linguini problem, we ask GPT-5 to solve it with the <analysis>/<answers>
format. This produces high-quality CoT examples that teach a model HOW to reason
about IOL problems, not just what to output.

Output: data/synthetic/iol_cot_train.jsonl
Format: chat messages with system (CoT prompt) + user (problem) + assistant
        (analysis + answers in tag format)

Usage:
    # Set ARKOR_API_KEY and ARKOR_ENDPOINT_URL in .env
    python hf-pipeline/generate_cot_data.py

    # Only generate for a specific task type
    python hf-pipeline/generate_cot_data.py --task-type text_to_num

    # Limit (for testing)
    python hf-pipeline/generate_cot_data.py --limit 5
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


def call_gpt5(
    context: str,
    query: str,
    task_type: str,
    endpoint_url: str,
    api_key: str,
    timeout: int = 180,
) -> str:
    """Call GPT-5 on the Arkor endpoint (OpenAI-compatible).

    GPT-5/o-series don't support max_tokens or temperature params.
    """
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
            "model": "openai/gpt-5-6-sol",
            "messages": messages,
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
    parser = argparse.ArgumentParser(description="Generate CoT training data via GPT-5")
    parser.add_argument(
        "--task-type", default="", help="Filter by task_type (e.g. text_to_num)"
    )
    parser.add_argument("--limit", type=int, default=0, help="Max problems (0=all)")
    parser.add_argument(
        "--output",
        default="data/synthetic/iol_cot_train.jsonl",
        help="Output JSONL path",
    )
    parser.add_argument(
        "--model", default="openai/gpt-5-6-sol", help="Arkor model to use"
    )
    args = parser.parse_args()

    endpoint = os.getenv("ARKOR_ENDPOINT_URL", "")
    api_key = os.getenv("ARKOR_API_KEY", "")

    if not endpoint or not api_key:
        print("Error: ARKOR_ENDPOINT_URL and ARKOR_API_KEY must be set in .env")
        sys.exit(1)

    print("[gen] Loading Linguini dataset...", flush=True)
    from datasets import load_dataset

    ds = load_dataset("facebook/linguini", split="test")
    problems = list(ds)

    if args.task_type:
        problems = [p for p in problems if p["task_type"] == args.task_type]
    if args.limit:
        problems = problems[: args.limit]

    print(f"[gen] Generating CoT for {len(problems)} problems using {args.model}")
    print(f"[gen] Output: {args.output}")
    print()

    # Load existing to skip already-done problems (resumable)
    done_ids = set()
    if os.path.exists(args.output):
        with open(args.output) as f:
            for line in f:
                try:
                    item = json.loads(line)
                    # Extract problem id from user content hash or metadata
                    if "problem_id" in item:
                        done_ids.add(item["problem_id"])
                except json.JSONDecodeError:
                    continue
        print(f"[gen] Resuming: {len(done_ids)} problems already done")

    results = []
    failed = []

    with open(args.output, "a") as out_f:
        for i, problem in enumerate(problems):
            pid = problem["id"]
            if pid in done_ids:
                print(f"  [{i + 1}/{len(problems)}] {pid} (skipped, already done)")
                continue

            context = problem["context"]
            query = problem["query"]
            task_type = problem["task_type"]

            print(
                f"  [{i + 1}/{len(problems)}] {pid} {task_type:15s} ...",
                end="",
                flush=True,
            )

            try:
                t0 = time.time()
                output = call_gpt5(context, query, task_type, endpoint, api_key)
                elapsed = time.time() - t0

                # Build the training example
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

                # Check if output has the expected tag format
                has_tags = "<answers>" in output and "</answers>" in output
                status = "OK" if has_tags else "NO_TAGS"

                print(f" {elapsed:.1f}s [{status}]")

            except Exception as e:
                print(f" ERROR: {e}")
                failed.append((pid, str(e)))
                # Wait before retry to avoid rate limits
                time.sleep(2)

    print()
    print(f"[gen] Done: {len(results)} examples generated, {len(failed)} failed")
    if failed:
        print(f"[gen] Failed problems: {[f[0] for f in failed]}")
    print(f"[gen] Output: {args.output}")


if __name__ == "__main__":
    main()
