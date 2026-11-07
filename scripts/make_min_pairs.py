#!/usr/bin/env python3
"""Generate a minimal-evidence ablation of puzzles.json.

For each puzzle, greedily select the smallest subset of evidence pairs
that still attests every morpheme used by any query answer (set cover
over pair['morphemes']). Everything else — morpheme bank, queries, gold —
is unchanged, so the only manipulated variable is evidence quantity.

This tests sample-efficient induction: can the model recover the grammar
from the minimum evidence a careful fieldworker would actually have?

Usage:
    python3 scripts/make_min_pairs.py \
        --input data/puzzles.json \
        --output eval-hackathon/data/puzzles_min1.json
"""

import argparse
import json
from pathlib import Path


def minimal_cover(puzzle: dict) -> list[dict]:
    needed = set()
    for q in puzzle["queries"]:
        needed.update(q["answer"])
    pairs = puzzle["pairs"]
    covered: set[str] = set()
    chosen: list[dict] = []
    remaining = list(pairs)
    while needed - covered and remaining:
        # pick the pair attesting the most still-needed morphemes
        best = max(
            remaining,
            key=lambda pr: len(set(pr.get("morphemes", [])) & (needed - covered)),
        )
        gain = set(best.get("morphemes", [])) & (needed - covered)
        if not gain:
            break
        chosen.append(best)
        covered |= set(best.get("morphemes", []))
        remaining.remove(best)
    return chosen


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    puzzles = json.loads(args.input.read_text())
    out = []
    for p in puzzles:
        kept = minimal_cover(p)
        q = dict(p)
        q["pairs"] = kept
        out.append(q)
        needed = {m for query in p["queries"] for m in query["answer"]}
        covered = {m for pr in kept for m in pr.get("morphemes", [])}
        print(
            f"{p['id']:28s} pairs {len(p['pairs'])} -> {len(kept)} "
            f"coverage {len(covered & needed)}/{len(needed)}"
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
