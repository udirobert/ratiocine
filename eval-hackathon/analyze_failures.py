#!/usr/bin/env python3
"""Failure taxonomy for generated-puzzle runs.

For every incorrect non-tutorial record, classify the error by comparing
the parsed prediction to gold morphemes:

  length    — wrong number of morphemes
  slot:N    — first differing morpheme position N (0=person/noun,
              1=root/stem, 2=tense, 3=agr-suffix/question, ...)
  exact     — (correct, excluded)

Usage: python3 eval-hackathon/analyze_failures.py eval-hackathon/data/puzzles_gen3.json
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def first_diff(pred, gold):
    for i, (a, b) in enumerate(zip(pred, gold, strict=False)):
        if a != b:
            return i
    return min(len(pred), len(gold))


def main() -> None:
    puzzles_path = Path(sys.argv[1])
    tag = puzzles_path.stem.replace("puzzles_", "")
    pmap = {p["id"]: p for p in json.loads(puzzles_path.read_text())}
    fam_of = {pid: p["family"].split("/")[-1] for pid, p in pmap.items()}

    # slot names per family (index -> label)
    slot_names = {
        "vowel-harmony": ["person", "root", "tense", "question"],
        "noun-class-agreement": ["agr-prefix", "vroot", "tense", "agr-suffix"],
        "conditioned-suppletion": ["person", "stem", "tense"],
    }

    stats = defaultdict(lambda: {"n": 0, "ok": 0, "errs": Counter(), "len_err": 0})
    examples = defaultdict(list)
    for f in sorted((ROOT / "eval-hackathon" / "results").glob(f"*_{tag}_t*.json")):
        model = f.name.split("_no_hint_")[0]
        for r in json.loads(f.read_text()):
            if "error" in r or "em_decomp" not in r:
                continue
            if r.get("difficulty") == "tutorial":
                continue
            fam = fam_of.get(r["puzzle"], "?")
            key = (model, fam)
            stats[key]["n"] += 1
            pred = r.get("morphemes") or []
            gold = r.get("gold") or []
            if r["em_decomp"]:
                stats[key]["ok"] += 1
                continue
            names = slot_names.get(fam, [])
            if len(pred) != len(gold):
                stats[key]["len_err"] += 1
                cat = "length"
            else:
                i = first_diff(pred, gold)
                cat = f"slot:{names[i] if i < len(names) else i}"
            stats[key]["errs"][cat] += 1
            if len(examples[key]) < 3:
                examples[key].append((r["puzzle"], gold, pred))

    for (model, fam), s in sorted(stats.items()):
        em = s["ok"] / s["n"] if s["n"] else 0
        print(
            f"\n=== {model} / {fam}  EM={em:.3f} n={s['n']} len_err={s['len_err']} ==="
        )
        for cat, c in s["errs"].most_common():
            print(f"  {cat:16s} {c:3d} ({c / s['n']:.0%})")
        for pid, g, pr in examples[(model, fam)][:2]:
            print(f"    e.g. {pid}: gold={g} pred={pr}")


if __name__ == "__main__":
    main()
