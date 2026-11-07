#!/usr/bin/env python3
"""Re-grade stored raw generations in results/*.json with the current grader.

Records keep `raw` (model output), `gold`, `puzzle`, `query`, and enough
metadata to rebuild the exact prompt context. Recomputes em_decomp,
em_surface, chrf, morf1, answer_text, morphemes in place — use after grader
fixes so all trials share one grading implementation.

Usage: python3 eval-hackathon/regrade.py [file ...]
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))

from run_eval import chrf, extract_answer_text, morpheme_f1  # noqa: E402
from run_models_for_ltb import (  # noqa: E402
    build_context,
    normalize_dashes,
    parse_morphemes,
    surface_forms,
)

RESULTS = Path(__file__).resolve().parent / "results"


def norm_surface(s: str) -> str:
    return (
        normalize_dashes(s)
        .replace(" ", "")
        .replace("+", "")
        .replace("-", "")
        .strip(".!?;:，。")
    )


def regrade_record(rec: dict, puzzles_by_id: dict) -> bool:
    puzzle = puzzles_by_id.get(rec["puzzle"])
    if puzzle is None or "raw" not in rec or not rec.get("raw"):
        return False
    query = next((q for q in puzzle["queries"] if q["id"] == rec["query"]), None)
    if query is None:
        return False
    tiles = [m for group in puzzle["morphemeBank"] for m in group]
    context = build_context(puzzle, query, "no_hint")
    raw = rec["raw"]

    answer_text = extract_answer_text(raw, context + "\n" + query["prompt"])
    morphemes = parse_morphemes(raw, query["answer"], tiles)
    morphemes = [p for m in morphemes for p in m.split("+") if p]

    gold = query["answer"]
    gold_joined = query.get("answerJoined") or "".join(gold)
    gold_surfaces = {norm_surface(sf) for sf in surface_forms(gold)}

    rec["answer_text"] = answer_text
    rec["morphemes"] = morphemes
    rec["em_decomp"] = morphemes == gold
    rec["em_surface"] = norm_surface(answer_text) in gold_surfaces
    rec["chrf"] = round(chrf("".join(morphemes) or answer_text, gold_joined), 4)
    rec["morf1"] = round(morpheme_f1(morphemes, gold), 4)
    rec.pop("error", None)
    return True


def main() -> None:
    files = [Path(a) for a in sys.argv[1:]] or sorted(RESULTS.glob("*.json"))
    for path in files:
        if not path.exists():
            continue
        try:
            recs = json.loads(path.read_text())
        except Exception:
            continue
        if not isinstance(recs, list):
            continue
        # load the puzzle file each record was generated from
        cache: dict[str, dict] = {}
        changed = 0
        for rec in recs:
            if "puzzle" not in rec or "query" not in rec:
                continue
            pf = rec.get("puzzles_file") or str(ROOT / "data" / "puzzles.json")
            # older records lack puzzles_file; infer obf from filename
            if "puzzles_file" not in rec and "obf" in path.name:
                pf = str(ROOT / "eval-hackathon" / "data" / "puzzles_obf_1.json")
            if pf not in cache:
                p = Path(pf)
                if not p.is_absolute():
                    p = ROOT / pf
                if not p.exists():
                    p = ROOT / "eval-hackathon" / "data" / p.name
                try:
                    cache[pf] = {x["id"]: x for x in json.loads(p.read_text())}
                except Exception:
                    cache[pf] = {}
            if regrade_record(rec, cache[pf]):
                changed += 1
        path.write_text(json.dumps(recs, indent=1, ensure_ascii=False))
        print(f"{path.name}: regraded {changed}/{len(recs)}")


if __name__ == "__main__":
    main()
