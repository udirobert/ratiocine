#!/usr/bin/env python3
"""Per-family / per-difficulty breakdown for generated-puzzle runs.

Usage: python3 eval-hackathon/analyze_gen.py eval-hackathon/data/puzzles_gen1.json
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "eval-hackathon"))


def main() -> None:
    puzzles_path = Path(sys.argv[1])
    tag = puzzles_path.stem.replace("puzzles_", "")
    pmap = {p["id"]: p for p in json.loads(puzzles_path.read_text())}
    fam_of = {pid: p["family"].split("/")[-1] for pid, p in pmap.items()}

    by_model = defaultdict(lambda: defaultdict(list))
    for f in sorted((ROOT / "eval-hackathon" / "results").glob(f"*_{tag}_t*.json")):
        model = f.name.split("_no_hint_")[0]
        for r in json.loads(f.read_text()):
            if "error" in r or "em_decomp" not in r:
                continue
            by_model[model][
                (fam_of.get(r["puzzle"], "?"), r.get("difficulty", "?"))
            ].append(r["em_decomp"])

    for model, cells in sorted(by_model.items()):
        print(f"\n=== {model} ===")
        fams = sorted({k[0] for k in cells})
        diffs = ["tutorial", "standard", "curveball"]
        header = (
            f"{'family':34s}" + "".join(f"{d:>12s}" for d in diffs) + f"{'ALL':>8s}"
        )
        print(header)
        for fam in fams:
            row = f"{fam:34s}"
            allv = []
            for d in diffs:
                v = cells.get((fam, d), [])
                allv += v
                row += f"{sum(v) / len(v):>12.3f}" if v else f"{'—':>12s}"
            n_scored = [
                x
                for (f_, d_), v in cells.items()
                if f_ == fam
                for x in v
                if d_ != "tutorial"
            ]
            row += f"{sum(n_scored) / len(n_scored):>8.3f}" if n_scored else "       —"
            print(row)
        # overall scored
        scored = [x for (f_, d_), v in cells.items() if d_ != "tutorial" for x in v]
        if scored:
            print(
                f"{'OVERALL':34s}{'':48s}{sum(scored) / len(scored):>8.3f}  n={len(scored)}"
            )


if __name__ == "__main__":
    main()
