"""
Local test harness for the IOL submission script.

Uses the Arkor live endpoint (or any OpenAI-compatible API) to test the
prompt + parsing logic from script.py against the Linguini benchmark,
without needing a local GPU or the competition's hidden test set.

Usage:
    # Set ARKOR_API_KEY and ARKOR_ENDPOINT_URL in .env
    python hf-pipeline/test_local.py

    # Use a different model on the endpoint
    python hf-pipeline/test_local.py --model google/gemma-4-31b-it

    # Only run N problems (quick check)
    python hf-pipeline/test_local.py --limit 10

    # Run a specific task type
    python hf-pipeline/test_local.py --task-type translation
"""

import argparse
import json
import os
import sys
import time

# Load .env
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# Import prompt + parsing from prompts.py (no torch dependency)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "submission"))
from prompts import (
    SYSTEM_PROMPT,
    SYSTEM_PROMPT_SIMPLE,
    USER_TEMPLATE,
    count_query_items,
    parse_answers,
)

# --- Scoring ---


def normalize(s: str) -> str:
    """Normalize a string for comparison."""
    return s.strip().lower().rstrip(".!?").strip()


def chrf(pred: str, ref: str) -> float:
    """Simplified chrF (character n-gram F-score) for a single prediction.

    Uses n=1..4 character n-grams, beta=2 (recall-weighted).
    This is an approximation of the sacrebleu chrF metric.
    """
    pred = pred.lower()
    ref = ref.lower()

    if not pred or not ref:
        return 0.0

    beta = 2.0
    precisions = []
    recalls = []

    for n in range(1, 5):
        pred_ngrams = {}
        ref_ngrams = {}

        for i in range(len(pred) - n + 1):
            gram = pred[i : i + n]
            pred_ngrams[gram] = pred_ngrams.get(gram, 0) + 1

        for i in range(len(ref) - n + 1):
            gram = ref[i : i + n]
            ref_ngrams[gram] = ref_ngrams.get(gram, 0) + 1

        if not pred_ngrams or not ref_ngrams:
            precisions.append(0.0)
            recalls.append(0.0)
            continue

        overlap = 0
        for gram, count in pred_ngrams.items():
            overlap += min(count, ref_ngrams.get(gram, 0))

        precisions.append(overlap / sum(pred_ngrams.values()))
        recalls.append(overlap / sum(ref_ngrams.values()))

    avg_p = sum(precisions) / len(precisions) if precisions else 0.0
    avg_r = sum(recalls) / len(recalls) if recalls else 0.0

    if avg_p + avg_r == 0:
        return 0.0

    f_score = (1 + beta**2) * (avg_p * avg_r) / (beta**2 * avg_p + avg_r)
    return f_score


def exact_match(pred: str, refs: list[str]) -> bool:
    """Check if prediction matches any of the reference answers."""
    n_pred = normalize(pred)
    return any(n_pred == normalize(r) for r in refs)


def score_item(pred_answers: list[str], gold: list) -> dict:
    """Score a single problem's answers against the gold answers.

    Gold can be:
    - list[str]: single-correct answers, one per item
    - list[list[str]]: multi-correct, each item accepts several answers
    """
    results = {"em": [], "chrf": []}

    for i, pred in enumerate(pred_answers):
        if i < len(gold):
            ref = gold[i]
            refs = ref if isinstance(ref, list) else [ref]

            em = exact_match(pred, refs)
            best_chrf = max(chrf(pred, r) for r in refs)

            results["em"].append(float(em))
            results["chrf"].append(best_chrf)

    return results


def overall_score(em_scores: list[float], chrf_scores: list[float]) -> float:
    """Competition score: geometric mean of mean EM and mean chrF."""
    if not em_scores or not chrf_scores:
        return 0.0
    mean_em = sum(em_scores) / len(em_scores)
    mean_chrf = sum(chrf_scores) / len(chrf_scores)
    if mean_em + mean_chrf == 0:
        return 0.0
    return (mean_em * mean_chrf) ** 0.5


# --- API call ---


def call_model(
    context: str,
    query: str,
    model: str,
    endpoint_url: str,
    api_key: str,
    system_prompt: str = SYSTEM_PROMPT,
    max_tokens: int = 2048,
) -> str:
    """Call an OpenAI-compatible chat completions endpoint."""
    import urllib.request

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

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


# --- Main ---


def main():
    parser = argparse.ArgumentParser(description="Test IOL submission locally")
    parser.add_argument(
        "--model", default="google/gemma-4-31b-it", help="Model ID on the endpoint"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max problems to test (0 = all)"
    )
    parser.add_argument(
        "--task-type", default="", help="Filter by task_type (e.g. translation)"
    )
    parser.add_argument(
        "--show-output", action="store_true", help="Print model output for each problem"
    )
    parser.add_argument(
        "--max-tokens", type=int, default=2048, help="Max tokens for model output"
    )
    parser.add_argument(
        "--prompt",
        choices=["cot", "simple"],
        default="cot",
        help="Prompt strategy: cot (chain-of-thought) or simple",
    )
    args = parser.parse_args()

    endpoint = os.getenv("ARKOR_ENDPOINT_URL", "")
    api_key = os.getenv("ARKOR_API_KEY", "")

    if not endpoint or not api_key:
        print("Error: ARKOR_ENDPOINT_URL and ARKOR_API_KEY must be set in .env")
        sys.exit(1)

    # Load Linguini dataset
    print("[test] Loading Linguini dataset...", flush=True)
    try:
        from datasets import load_dataset

        ds = load_dataset("facebook/linguini", split="test")
    except Exception as e:
        print(f"[test] Failed to load dataset: {e}")
        print("[test] Make sure 'datasets' is installed and you have internet")
        sys.exit(1)

    # Filter
    problems = list(ds)
    if args.task_type:
        problems = [p for p in problems if p["task_type"] == args.task_type]
    if args.limit:
        problems = problems[: args.limit]

    print(f"[test] Testing {len(problems)} problems with {args.model}", flush=True)
    print(f"[test] Endpoint: {endpoint}", flush=True)
    print(f"[test] Prompt: {args.prompt}, max_tokens: {args.max_tokens}", flush=True)
    print()

    system_prompt = SYSTEM_PROMPT if args.prompt == "cot" else SYSTEM_PROMPT_SIMPLE

    all_em = []
    all_chrf = []
    by_type = {}

    for i, problem in enumerate(problems):
        pid = problem["id"]
        context = problem["context"]
        query = problem["query"]
        task_type = problem["task_type"]
        gold = problem["answer"]
        if isinstance(gold, str):
            import ast

            gold = ast.literal_eval(gold)

        try:
            t0 = time.time()
            output = call_model(
                context,
                query,
                args.model,
                endpoint,
                api_key,
                system_prompt=system_prompt,
                max_tokens=args.max_tokens,
            )
            elapsed = time.time() - t0

            n_expected = count_query_items(query)
            if not n_expected:
                n_expected = len(gold) if isinstance(gold, list) else 1

            pred_answers = parse_answers(output, n_expected=n_expected)
            results = score_item(pred_answers, gold)

            all_em.extend(results["em"])
            all_chrf.extend(results["chrf"])

            if task_type not in by_type:
                by_type[task_type] = {"em": [], "chrf": []}
            by_type[task_type]["em"].extend(results["em"])
            by_type[task_type]["chrf"].extend(results["chrf"])

            em_pct = (
                sum(results["em"]) / len(results["em"]) * 100 if results["em"] else 0
            )
            avg_chrf = (
                sum(results["chrf"]) / len(results["chrf"]) * 100
                if results["chrf"]
                else 0
            )

            status = "OK" if any(results["em"]) else "chrf"
            print(
                f"  [{i + 1}/{len(problems)}] {pid} {task_type:15s} "
                f"EM={em_pct:5.1f}% chrF={avg_chrf:5.1f}% "
                f"({len(pred_answers)} ans, {elapsed:.1f}s) [{status}]",
                flush=True,
            )

            if args.show_output:
                print(f"    Output: {output[:200]}...")
                print(f"    Parsed: {pred_answers}")
                print(f"    Gold:   {gold}")
                print()

        except Exception as e:
            print(f"  [{i + 1}/{len(problems)}] {pid} ERROR: {e}", flush=True)
            all_em.append(0.0)
            all_chrf.append(0.0)

    # Summary
    print()
    print("=" * 60)
    print("OVERALL SCORE")
    print("=" * 60)
    mean_em = sum(all_em) / len(all_em) if all_em else 0
    mean_chrf = sum(all_chrf) / len(all_chrf) if all_chrf else 0
    score = (mean_em * mean_chrf) ** 0.5 if (mean_em + mean_chrf) > 0 else 0
    print(f"  Exact match:  {mean_em:.4f} ({sum(all_em)}/{len(all_em)} items)")
    print(f"  chrF:         {mean_chrf:.4f}")
    print(f"  Score (geo):  {score:.4f}")
    print()

    print("BY TASK TYPE")
    print("-" * 60)
    print(f"  {'Type':20s} {'EM':>8s} {'chrF':>8s} {'Score':>8s} {'Items':>6s}")
    print("-" * 60)
    for ttype, scores in sorted(by_type.items()):
        em = sum(scores["em"]) / len(scores["em"]) if scores["em"] else 0
        ch = sum(scores["chrf"]) / len(scores["chrf"]) if scores["chrf"] else 0
        sc = (em * ch) ** 0.5 if (em + ch) > 0 else 0
        print(f"  {ttype:20s} {em:8.4f} {ch:8.4f} {sc:8.4f} {len(scores['em']):6d}")


if __name__ == "__main__":
    main()
