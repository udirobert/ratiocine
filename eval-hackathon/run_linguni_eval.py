#!/usr/bin/env python3
"""micro1 Eval Hackathon — Linguini IOL eval runner (API models).

Mirrors hf-pipeline/eval_14b_awq.py scoring (per-item EM + chrF, geometric
mean) but calls OpenAI-compatible providers instead of a local HF model, so
frontier API models can be evaluated with zero GPU.

Dataset: facebook/linguini test split (160 problems), fetched via the HF
datasets-server rows API — no `datasets` dependency required.

Usage:
    python3 eval-hackathon/run_linguni_eval.py --model openai/gpt-oss-120b --provider groq
    python3 eval-hackathon/run_linguni_eval.py --model <id> --limit 20 --task-type match_letters
"""

import argparse
import ast
import json
import logging
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))

import llm_providers  # noqa: E402
from prompts import (  # noqa: E402
    USER_TEMPLATE,
    count_query_items,
    get_system_prompt,
    parse_answers,
)

RESULTS_DIR = Path(__file__).resolve().parent / "results"
HF_ROWS = (
    "https://datasets-server.huggingface.co/rows"
    "?dataset=facebook%2Flinguini&config=default&split=test"
)


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return env


def fetch_linguni() -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        url = f"{HF_ROWS}&offset={offset}&length=100"
        ctx = llm_providers._ssl_context()
        with urllib.request.urlopen(url, timeout=60, context=ctx) as resp:
            data = json.load(resp)
        batch = data.get("rows", [])
        rows.extend(r["row"] for r in batch)
        if len(batch) < 100:
            break
        offset += 100
    return rows


def normalize(s: str) -> str:
    return s.strip().lower().rstrip(".!?").strip()


def chrf(pred: str, ref: str, beta: float = 2.0) -> float:
    pred, ref = pred.lower(), ref.lower()
    if not pred or not ref:
        return 0.0
    precisions, recalls = [], []
    for n in range(1, 5):
        pn: dict[str, int] = {}
        rn: dict[str, int] = {}
        for i in range(len(pred) - n + 1):
            g = pred[i : i + n]
            pn[g] = pn.get(g, 0) + 1
        for i in range(len(ref) - n + 1):
            g = ref[i : i + n]
            rn[g] = rn.get(g, 0) + 1
        overlap = sum(min(c, rn.get(g, 0)) for g, c in pn.items())
        precisions.append(overlap / sum(pn.values()) if pn else 0.0)
        recalls.append(overlap / sum(rn.values()) if rn else 0.0)
    p = sum(precisions) / len(precisions)
    r = sum(recalls) / len(recalls)
    if p + r == 0:
        return 0.0
    return (1 + beta**2) * p * r / (beta**2 * p + r)


def exact_match(pred: str, refs: list) -> bool:
    n_pred = normalize(pred)
    return any(n_pred == normalize(r) for r in refs)


def call_model(
    messages: list[dict],
    model: str,
    env: dict,
    provider_name: str | None,
    max_tokens: int,
) -> tuple[str, str]:
    # temperature=None omits the field — claude-opus on the Neon gateway
    # rejects it outright (400), and gpt-5 reasoning models ignore it anyway.
    payload = llm_providers.build_payload(
        model, messages, max_tokens=max_tokens, temperature=None
    )
    if provider_name:
        provider = next(
            (p for p in llm_providers.PROVIDERS if p["name"] == provider_name),
            None,
        )
        if provider is None or provider["env_key"] not in env:
            raise RuntimeError(f"provider {provider_name!r} unknown or key missing")
        return llm_providers.call_chat(env, provider, payload), provider["name"]
    return llm_providers.call_with_failover(env, payload)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--provider", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--task-type", default="")
    ap.add_argument("--max-tokens", type=int, default=2048)
    ap.add_argument("--output", type=Path, default=None)
    ap.add_argument("--append", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    env = load_env()

    problems = fetch_linguni()
    if args.task_type:
        problems = [p for p in problems if p["task_type"] == args.task_type]
    if args.limit:
        problems = problems[: args.limit]
    logging.info(f"[eval] {len(problems)} problems, model={args.model}")

    out_path = args.output or (
        RESULTS_DIR
        / f"linguni_{args.model.replace('/', '_')}_{args.task_type or 'all'}.json"
    )
    RESULTS_DIR.mkdir(exist_ok=True)

    records: list[dict] = []
    if args.append and out_path.exists():
        records = json.loads(out_path.read_text())
        done = {r["id"] for r in records}
    else:
        done = set()

    all_em: list[float] = []
    all_chrf: list[float] = []
    by_type: dict[str, dict[str, list[float]]] = {}

    for i, problem in enumerate(problems):
        pid = problem["id"]
        if pid in done:
            logging.info(f"[{i + 1}/{len(problems)}] {pid} — already run")
            continue
        context, query = problem["context"], problem["query"]
        tt = problem["task_type"]
        gold = problem["answer"]
        if isinstance(gold, str):
            gold = ast.literal_eval(gold)

        messages = [
            {"role": "system", "content": get_system_prompt(tt)},
            {
                "role": "user",
                "content": USER_TEMPLATE.format(
                    context=context.strip(), query=query.strip()
                ),
            },
        ]
        t0 = time.time()
        try:
            generated, provider = call_model(
                messages, args.model, env, args.provider, args.max_tokens
            )
            elapsed = time.time() - t0
        except Exception as e:
            logging.error(f"[{i + 1}/{len(problems)}] {pid} ERROR: {e}")
            records.append(
                {
                    "id": pid,
                    "task_type": tt,
                    "context": context,
                    "query": query,
                    "gold": gold,
                    "raw": "",
                    "error": str(e),
                    "model": args.model,
                    "provider": args.provider or "failover",
                }
            )
            out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))
            all_em.append(0.0)
            all_chrf.append(0.0)
            continue

        n_expected = count_query_items(query)
        if not n_expected:
            n_expected = len(gold) if isinstance(gold, list) else 1
        pred_answers = parse_answers(
            generated,
            n_expected=n_expected,
            task_type=tt,
            context=context + "\n" + query,
        )

        em_scores, chrf_scores = [], []
        for j, pred in enumerate(pred_answers):
            if j < len(gold):
                ref = gold[j]
                refs = ref if isinstance(ref, list) else [ref]
                em_scores.append(float(exact_match(pred, refs)))
                chrf_scores.append(max(chrf(pred, r) for r in refs))

        all_em.extend(em_scores)
        all_chrf.extend(chrf_scores)
        bt = by_type.setdefault(tt, {"em": [], "chrf": []})
        bt["em"].extend(em_scores)
        bt["chrf"].extend(chrf_scores)

        em_pct = sum(em_scores) / len(em_scores) * 100 if em_scores else 0
        ch_pct = sum(chrf_scores) / len(chrf_scores) * 100 if chrf_scores else 0
        logging.info(
            f"[{i + 1}/{len(problems)}] {pid} {tt:15s} "
            f"EM={em_pct:5.1f}% chrF={ch_pct:5.1f}% ({elapsed:.1f}s)"
        )
        records.append(
            {
                "id": pid,
                "task_type": tt,
                "context": context,
                "query": query,
                "gold": gold,
                "raw": generated,
                "pred_answers": pred_answers,
                "em": em_scores,
                "chrf": chrf_scores,
                "elapsed_s": round(elapsed, 1),
                "model": args.model,
                "provider": provider,
            }
        )
        out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))

    # Running summary over completed records
    em_all = [e for r in records if "em" in r for e in r["em"]]
    ch_all = [c for r in records if "chrf" in r for c in r["chrf"]]
    mean_em = sum(em_all) / len(em_all) if em_all else 0
    mean_ch = sum(ch_all) / len(ch_all) if ch_all else 0
    score = (mean_em * mean_ch) ** 0.5 if (mean_em + mean_ch) > 0 else 0
    print("\n" + "=" * 60)
    print(f"LINGUNI SUMMARY — {args.model} (n_problems={len(records)})")
    print("=" * 60)
    print(f"  Exact match:  {mean_em:.4f} ({sum(em_all):.0f}/{len(em_all)} items)")
    print(f"  chrF:         {mean_ch:.4f}")
    print(f"  Score (geo):  {score:.4f}")
    print("\n  by task type:")
    types: dict[str, dict[str, list]] = {}
    for r in records:
        if "em" not in r:
            continue
        t = types.setdefault(r["task_type"], {"em": [], "chrf": []})
        t["em"].extend(r["em"])
        t["chrf"].extend(r["chrf"])
    for tt, s in sorted(types.items()):
        em = sum(s["em"]) / len(s["em"]) if s["em"] else 0
        ch = sum(s["chrf"]) / len(s["chrf"]) if s["chrf"] else 0
        sc = (em * ch) ** 0.5 if (em + ch) > 0 else 0
        print(
            f"    {tt:20s} EM={em:.4f} chrF={ch:.4f} score={sc:.4f} "
            f"items={len(s['em'])}"
        )


if __name__ == "__main__":
    main()
