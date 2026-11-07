#!/usr/bin/env python3
"""Aggregate eval-hackathon/results/*.json into a results table.

Groups records by (model, condition, trial) where condition is derived from
puzzles_file + shuffle_seed recorded on each record:

  canonical : data/puzzles.json, no shuffle
  obf1      : puzzles_obf_1.json, no shuffle
  shuf1     : data/puzzles.json, shuffle_seed=1

Reports per-condition means over non-tutorial queries, plus pass^k-style
consistency: for each query, the fraction of trials with a correct surface
form, averaged (this is "consistency@k", the complement of pass^k reporting).

Usage: python3 eval-hackathon/aggregate.py [--markdown]
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

RESULTS = Path(__file__).resolve().parent / "results"
CANON = "data/puzzles.json"


def condition(rec: dict) -> str:
    pf = rec.get("puzzles_file", CANON)
    if "obf" in pf:
        return "obf1"
    if "min1" in pf:
        return "min1"
    m = re.search(r"gen(\d+)", pf)
    if m:
        return f"gen{m.group(1)}"
    if "seg" in rec.get("prompt_variant", ""):
        return "seg"
    if rec.get("shuffle_seed"):
        return f"shuf{rec['shuffle_seed']}"
    return "canonical"


def success(rec: dict) -> bool:
    return bool(rec.get("em_surface") or rec.get("em_decomp"))


def load_all() -> dict:
    """(model, condition) -> trial -> list[rec]; also (model,cond,trial,puzzle,query)->rec"""
    runs: dict[tuple, dict[int, list]] = defaultdict(lambda: defaultdict(list))
    for f in sorted(RESULTS.glob("*.json")):
        try:
            recs = json.loads(f.read_text())
        except Exception:
            continue
        if not isinstance(recs, list) or not recs:
            continue
        for r in recs:
            if "error" in r or ("em_surface" not in r and "em_decomp" not in r):
                continue
            # headline arms all use the no_hint prompt; exclude control
            # variants (e.g. no_bank) so they don't masquerade as trials
            if r.get("prompt_variant") not in (None, "no_hint", "default", "seg"):
                continue
            key = (r.get("model", "?"), condition(r))
            runs[key][r.get("trial", 0)].append(r)
    return runs


def score_rows(recs: list[dict]) -> dict:
    scored = [r for r in recs if r.get("difficulty") != "tutorial"] or recs
    n = len(scored)
    if not n:
        return {}
    return {
        "n": n,
        "em_surf": sum(r.get("em_surface", r.get("em_decomp", 0)) for r in scored) / n,
        "em_dec": sum(r["em_decomp"] for r in scored) / n,
        "chrf": sum(r["chrf"] for r in scored) / n,
        "f1": sum(r["morf1"] for r in scored) / n,
    }


def consistency(trials: dict[int, list]) -> float | None:
    """Mean over queries of fraction-of-trials correct (surface EM)."""
    by_item: dict[tuple, list] = defaultdict(list)
    for t, recs in trials.items():
        for r in recs:
            if r.get("difficulty") == "tutorial":
                continue
            by_item[(r["puzzle"], r["query"])].append(success(r))
    if not by_item:
        return None
    return sum(sum(v) / len(v) for v in by_item.values()) / len(by_item)


def pass_k_all(trials: dict[int, list]) -> float | None:
    """Fraction of queries correct in EVERY trial (strict pass^k)."""
    by_item: dict[tuple, list] = defaultdict(list)
    for t, recs in trials.items():
        for r in recs:
            if r.get("difficulty") == "tutorial":
                continue
            by_item[(r["puzzle"], r["query"])].append(success(r))
    if not by_item:
        return None
    return sum(all(v) for v in by_item.values()) / len(by_item)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--markdown", action="store_true")
    args = ap.parse_args()

    runs = load_all()
    # group trials per (model, condition)
    grouped: dict[tuple, dict[int, list]] = defaultdict(dict)
    for (model, cond), trials in runs.items():
        for t, recs in trials.items():
            grouped[(model, cond)][t] = recs

    models = sorted({m for m, _ in grouped})
    conds = ["canonical", "obf1", "min1", "gen1", "gen2", "gen3", "seg", "shuf1"]

    if args.markdown:
        print(
            "| Model | Condition | Trials | EM-surf | EM-decomp | chrF | morf1 "
            "| consistency | pass^k-all |"
        )
        print("|---|---|---|---|---|---|---|---|---|")
        for m in models:
            for c in conds:
                trials = grouped.get((m, c))
                if not trials:
                    continue
                agg_em, agg_dec, agg_ch, agg_f1 = [], [], [], []
                for t in sorted(trials):
                    s = score_rows(trials[t])
                    if not s:
                        continue
                    agg_em.append(s["em_surf"])
                    agg_dec.append(s["em_dec"])
                    agg_ch.append(s["chrf"])
                    agg_f1.append(s["f1"])
                if not agg_em:
                    continue
                k = len(agg_em)
                cons = consistency(trials)
                pk = pass_k_all(trials)
                print(
                    f"| {m} | {c} | {k} | {sum(agg_em) / k:.3f} | "
                    f"{sum(agg_dec) / k:.3f} | {sum(agg_ch) / k:.3f} | "
                    f"{sum(agg_f1) / k:.3f} | "
                    f"{cons:.3f} | {pk:.3f} |"
                )
        return

    for m in models:
        print(f"\n{m}")
        for c in conds:
            trials = grouped.get((m, c))
            if not trials:
                continue
            ems, decs, chs, f1s = [], [], [], []
            for t in sorted(trials):
                s = score_rows(trials[t])
                if s:
                    ems.append(s["em_surf"])
                    decs.append(s["em_dec"])
                    chs.append(s["chrf"])
                    f1s.append(s["f1"])
            cons = consistency(trials)
            pk = pass_k_all(trials)
            print(
                f"  {c:9s} trials={len(ems)} "
                f"EMsurf={sum(ems) / len(ems):.3f}±{(max(ems) - min(ems)) / 2:.3f} "
                f"EMdec={sum(decs) / len(decs):.3f} chrF={sum(chs) / len(chs):.3f} "
                f"f1={sum(f1s) / len(f1s):.3f} consist={cons:.3f} passk={pk:.3f}"
            )


if __name__ == "__main__":
    main()
