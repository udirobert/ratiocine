#!/usr/bin/env python3
"""Score recorded model outputs for the 17 LTB queries against ground truth.

Reads data/puzzles.json (gold answers) and data/ltb_model_outputs.json (raw
model answers recorded by run_models_for_ltb.py) and emits an exact
per-query, per-model correctness table as markdown or JSON.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUZZLES_PATH = ROOT / "data" / "puzzles.json"
OUTPUTS_PATH = ROOT / "data" / "ltb_model_outputs.json"

LTB_PUZZLE_IDS = [
    "apurina-verb-agreement",
    "swahili-person-tense",
    "turkish-vowel-harmony",
    "quechua-person-endings",
    "nahuatl-both-ends",
]


def load_queries() -> dict[str, dict]:
    with open(PUZZLES_PATH) as f:
        puzzles = json.load(f)
    queries = {}
    for p in puzzles:
        if p["id"] not in LTB_PUZZLE_IDS:
            continue
        evidence = {row["target"] for row in p["pairs"]}
        for q in p["queries"]:
            queries[f"{p['id']}:{q['id']}"] = {
                "puzzle": p["id"],
                "language": p["language"],
                "prompt": q["prompt"],
                "gold": " ".join(q["answer"]),
                "evidence": evidence,
            }
    return queries


def classify_failure(raw: str, answer: str, info: dict) -> str:
    """Label why a recorded answer was wrong: harness vs model."""
    gold = info["gold"]
    compact = gold.replace(" ", "")
    if answer.startswith(("Step 1", "Step", "Identify")):
        if "<answers>" in raw and compact in raw.replace(" ", ""):
            return "parse_artifact"
        return "truncated_output"
    if answer in info["evidence"]:
        return "evidence_echo"
    if compact == answer.replace(" ", ""):
        return "segmentation_only"
    if compact in raw.replace(" ", ""):
        return "parse_artifact"
    if "<answers>" not in raw:
        return "truncated_output"
    return "wrong_answer"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json", action="store_true", help="Emit JSON instead of markdown"
    )
    args = parser.parse_args()

    with open(OUTPUTS_PATH) as f:
        outputs = json.load(f)

    queries = load_queries()
    models = sorted({o["model"] for entry in outputs.values() for o in entry})

    results = []
    for key, info in queries.items():
        row = {
            "key": key,
            **info,
            # kept as a set for the evidence_echo check, flattened for JSON
            "evidence": sorted(info["evidence"]),
            "models": {},
        }
        for entry in outputs.get(key, []):
            ans = (
                " ".join(entry["answer"])
                if isinstance(entry["answer"], list)
                else entry["answer"]
            )
            correct = ans == info["gold"]
            ftype = None if correct else classify_failure(entry["raw"], ans, info)
            row["models"][entry["model"]] = {
                "answer": ans,
                "correct": correct,
                "failure_type": ftype,
            }
        results.append(row)

    counts = {
        m: sum(1 for r in results if r["models"].get(m, {}).get("correct"))
        for m in models
    }

    if args.json:
        json.dump(
            {"models": models, "scores": counts, "results": results},
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
        return

    print(f"{'query':<34} {'gold':<24}", *(f"{m.split('/')[-1]:<22}" for m in models))
    print("-" * (60 + 24 * len(models)))
    for r in results:
        cells = []
        for m in models:
            got = r["models"].get(m)
            cells.append(
                "—"
                if got is None
                else ("✓" if got["correct"] else f"✗ {got['answer'][:18]}")
            )
        prompt = r["prompt"][:32]
        print(f"{prompt:<34} {r['gold']:<24}", *(f"{c:<22}" for c in cells))
    print()
    for m in models:
        print(f"{m}: {counts[m]} / {len(results)} correct")
        print("  failures:")
        for r in results:
            got = r["models"].get(m)
            if got and not got["correct"]:
                print(
                    f"    [{r['language']}] {r['prompt']!r}: got {got['answer']!r}, "
                    f"gold {r['gold']!r} ({got['failure_type']})"
                )


if __name__ == "__main__":
    main()
