#!/usr/bin/env python3
"""Score recorded model outputs for the LTB queries against ground truth.

Reads data/puzzles.json (gold answers) and data/ltb_model_outputs.json (raw
model answers recorded by run_models_for_ltb.py) and emits exact per-query,
per-model correctness as markdown or JSON.

Each recording is graded twice, because the two things people call "correct"
here are different:

  EM_decomp  — the answer is the tile decomposition (spaced, or re-segmentable
               from the tile bank).
  EM_surface — the answer is an attested surface form of that decomposition,
               including the vowel-elided spelling ('tulimba').

A gap between the two columns is a format/instruction effect, not a reasoning
failure, so the report keeps them apart instead of collapsing to one score.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from run_models_for_ltb import segment_from_bank, surface_forms  # noqa: E402

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
        tiles = [m for group in p["morphemeBank"] for m in group]
        for q in p["queries"]:
            queries[f"{p['id']}:{q['id']}"] = {
                "puzzle": p["id"],
                "language": p["language"],
                "prompt": q["prompt"],
                "gold": " ".join(q["answer"]),
                "gold_morphs": q["answer"],
                "evidence": evidence,
                "tiles": tiles,
            }
    return queries


def grade(info: dict, answer_text: str, segmented: list[str]) -> tuple[bool, bool]:
    """(EM_decomp, EM_surface) for one recorded answer."""
    gold = info["gold_morphs"]
    compact = answer_text.replace(" ", "").replace("-", "")
    decomp = segmented == gold or answer_text == info["gold"]
    if not decomp and compact:
        decomp = segment_from_bank(compact, info["tiles"]) == gold
    surface = bool(compact) and compact in surface_forms(gold)
    return decomp, surface


def _degenerate(raw: str) -> bool:
    """True when the completion opens with one character repeated.

    Featherless serves some open-weight models a blank, or a page of '!!!!' with a
    few tokens of text after it. Either way the lane, not the model, failed.
    """
    head = raw.lstrip()[:200]
    if len(head) < 50:
        return False
    _, most_frequent = Counter(head).most_common(1)[0]
    return most_frequent / len(head) > 0.9


def classify_failure(
    info: dict, raw: str, answer_text: str, surface: bool, variant: str
) -> str:
    """Label why a recorded answer missed the decomposition."""
    if surface:
        return "unsegmented_surface_form"
    if not raw.strip() or _degenerate(raw):
        # Featherless serves some open-weight models a blank or a page of '!!!!'.
        # That is the lane failing, not the model reasoning.
        return "lane_failure"
    if answer_text.startswith(("Step 1", "Step", "Identify")):
        return "parse_artifact" if "<answers>" in raw else "truncated_output"
    if answer_text in info["evidence"]:
        return "evidence_echo"
    # Only the default arm uses the <analysis>/<answers> tag protocol; the
    # decomposition arm is told to output bare morphemes, so no tags there.
    if variant == "default" and "<answers>" not in raw:
        return "truncated_output"
    return "wrong_answer"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json", action="store_true", help="Emit JSON instead of markdown"
    )
    parser.add_argument(
        "--variant",
        default="all",
        help="Filter to one prompt variant (default|decomposition|no_hint|all)",
    )
    args = parser.parse_args()

    with open(OUTPUTS_PATH) as f:
        outputs = json.load(f)

    queries = load_queries()

    results = []
    for key, info in queries.items():
        row = {
            "key": key,
            **{k: v for k, v in info.items() if k != "gold_morphs"},
            # kept as a set for the evidence_echo check, flattened for JSON
            "evidence": sorted(info["evidence"]),
            "answers": {},
        }
        for entry in outputs.get(key, []):
            variant = entry.get("prompt_variant", "default")
            if args.variant != "all" and variant != args.variant:
                continue
            answer_text = entry.get("answer_text") or " ".join(entry.get("answer", []))
            segmented = entry.get("answer", [])
            decomp, surface = grade(info, answer_text, segmented)
            row["answers"][f"{entry['model']}@{variant}"] = {
                "model": entry["model"],
                "variant": variant,
                "provider": entry.get("provider"),
                "said": answer_text,
                "segmented": segmented,
                "em_decomp": decomp,
                "em_surface": surface,
                "failure_type": (
                    None
                    if decomp
                    else classify_failure(
                        info, entry["raw"], answer_text, surface, variant
                    )
                ),
            }
        results.append(row)

    columns = sorted({c for r in results for c in r["answers"]})
    scores = {
        c: {
            "decomp": sum(
                1 for r in results if r["answers"].get(c, {}).get("em_decomp")
            ),
            "surface": sum(
                1 for r in results if r["answers"].get(c, {}).get("em_surface")
            ),
            "n": sum(1 for r in results if c in r["answers"]),
        }
        for c in columns
    }

    if args.json:
        json.dump(
            {"columns": columns, "scores": scores, "results": results},
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
        return

    print(f"variant filter: {args.variant} | {len(results)} items\n")
    print(f"{'model@variant':<52} {'EM_decomp':>10} {'EM_surface':>11}")
    print("-" * 76)
    for c in columns:
        s = scores[c]
        print(f"{c:<52} {s['decomp']:>7}/{s['n']} {s['surface']:>8}/{s['n']}")
    print()
    for c in columns:
        misses = [
            (r, r["answers"][c])
            for r in results
            if c in r["answers"] and not r["answers"][c]["em_decomp"]
        ]
        if not misses:
            continue
        print(f"{c} — decomposition misses:")
        for r, got in misses:
            print(
                f"    [{r['language']}] {r['prompt']!r}: said {got['said']!r}, "
                f"gold {r['gold']!r} ({got['failure_type']})"
            )
        print()


if __name__ == "__main__":
    main()
