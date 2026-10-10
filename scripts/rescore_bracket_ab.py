"""Paired A/B rescore of a raw-generation dump: bracket-strip on vs off.

Generation is greedy and therefore deterministic, so the expensive part only
has to be paid once. `eval_14b_awq.py --dump` writes the verbatim model output
per problem; this script re-parses those same strings twice — once with
`context=None` (the behaviour before the conditional bracket strip) and once
with the problem's context+query (the behaviour after) — and scores both with
the harness's own metric. Identical generations on both arms, so any delta is
attributable to parsing alone.

Usage:
    python3 scripts/rescore_bracket_ab.py data/eval/raw_generations_*.json
"""

import ast
import json
import re
import sys
from pathlib import Path

sys.path.insert(
    0, str(Path(__file__).resolve().parents[1] / "hf-pipeline" / "submission")
)

from prompts import count_query_items, parse_answers

# --- Scorer: copied verbatim from eval_14b_awq.py so numbers are comparable ---


def normalize(s):
    return s.strip().lower().rstrip(".!?").strip()


def chrf(pred, ref):
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
            g = pred[i : i + n]
            pred_ngrams[g] = pred_ngrams.get(g, 0) + 1
        for i in range(len(ref) - n + 1):
            g = ref[i : i + n]
            ref_ngrams[g] = ref_ngrams.get(g, 0) + 1
        if not pred_ngrams or not ref_ngrams:
            precisions.append(0.0)
            recalls.append(0.0)
            continue
        overlap = 0
        for g, c in pred_ngrams.items():
            overlap += min(c, ref_ngrams.get(g, 0))
        precisions.append(overlap / sum(pred_ngrams.values()))
        recalls.append(overlap / sum(ref_ngrams.values()))
    avg_p = sum(precisions) / len(precisions) if precisions else 0.0
    avg_r = sum(recalls) / len(recalls) if recalls else 0.0
    if avg_p + avg_r == 0:
        return 0.0
    return (1 + beta**2) * (avg_p * avg_r) / (beta**2 * avg_p + avg_r)


def exact_match(pred, refs):
    n_pred = normalize(pred)
    return any(n_pred == normalize(r) for r in refs)


WRAPPED = re.compile(r"^\[[\s\S]*\]$")


def score_arm(records, use_context):
    """Parse every dump record one way and score it. Returns totals + per-item."""
    em, cf, items = [], [], []
    for r in records:
        gold = r["gold"]
        if isinstance(gold, str):
            gold = ast.literal_eval(gold)
        n_expected = count_query_items(r["query"]) or (
            len(gold) if isinstance(gold, list) else 1
        )
        ctx = (r["context"] + "\n" + r["query"]) if use_context else None
        preds = parse_answers(
            r["raw"], n_expected=n_expected, task_type=r["task_type"], context=ctx
        )
        for j, pred in enumerate(preds):
            if j >= len(gold):
                continue
            ref = gold[j]
            refs = ref if isinstance(ref, list) else [ref]
            e = float(exact_match(pred, refs))
            c = max(chrf(pred, x) for x in refs)
            em.append(e)
            cf.append(c)
            items.append(
                {"id": r["id"], "type": r["task_type"], "i": j, "pred": pred, "em": e}
            )
    return em, cf, items


def summarize(name, em, cf):
    mean_em = sum(em) / len(em) if em else 0.0
    mean_cf = sum(cf) / len(cf) if cf else 0.0
    score = (mean_em * mean_cf) ** 0.5 if (mean_em + mean_cf) > 0 else 0.0
    print(
        f"  {name:<22} EM={mean_em:.4f} ({int(sum(em))}/{len(em)})"
        f"  chrF={mean_cf:.4f}  score={score:.4f}"
    )
    return mean_em, mean_cf, score


def main(path):
    with open(path) as fh:
        records = json.load(fh)
    errored = [r for r in records if r.get("error")]
    print(f"dump: {path}")
    print(f"records: {len(records)}  (errored during generation: {len(errored)})\n")

    # How often does the model wrap, and where would stripping even apply?
    wrapped_items = 0
    wrapped_problems = set()
    for r in records:
        gold = r["gold"]
        if isinstance(gold, str):
            gold = ast.literal_eval(gold)
        n = count_query_items(r["query"]) or len(gold)
        for p in parse_answers(
            r["raw"], n_expected=n, task_type=r["task_type"], context=None
        ):
            if WRAPPED.match(p.strip()):
                wrapped_items += 1
                wrapped_problems.add(r["id"])

    print("BRACKET INCIDENCE (old parse, context=None)")
    print(f"  bracket-wrapped predictions: {wrapped_items}")
    print(f"  problems affected:           {len(wrapped_problems)}\n")

    em_old, cf_old, items_old = score_arm(records, use_context=False)
    em_new, cf_new, items_new = score_arm(records, use_context=True)

    print("PAIRED RESCORE (same generations, parsing differs)")
    o = summarize("OLD (no strip)", em_old, cf_old)
    n = summarize("NEW (conditional)", em_new, cf_new)
    print(
        f"\n  delta                  EM={n[0] - o[0]:+.4f}"
        f"  chrF={n[1] - o[1]:+.4f}  score={n[2] - o[2]:+.4f}"
    )

    # Which individual items flipped, in either direction?
    gained = [
        (a["id"], a["type"], b["pred"], a["pred"])
        for a, b in zip(items_new, items_old, strict=False)
        if a["em"] > b["em"]
    ]
    lost = [
        (a["id"], a["type"], b["pred"], a["pred"])
        for a, b in zip(items_new, items_old, strict=False)
        if a["em"] < b["em"]
    ]
    print(f"\n  items gained (wrong -> right): {len(gained)}")
    for x in gained[:20]:
        print(f"    + {x[0]} {x[1]:<14} {x[2]!r} -> {x[3]!r}")
    print(f"  items lost (right -> wrong):   {len(lost)}")
    for x in lost[:20]:
        print(f"    - {x[0]} {x[1]:<14} {x[2]!r} -> {x[3]!r}")
    if not gained and not lost:
        print("  (no item changed EM state)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
