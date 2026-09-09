#!/usr/bin/env python3
"""Convert our IOL puzzles into Last Translation Benchmark V2 entries."""

import argparse
import json
import logging
from pathlib import Path
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(message)s")

ROOT = Path(__file__).resolve().parent.parent

PUZZLES_PATH = ROOT / "data" / "puzzles.json"
OUTPUT_PATH = ROOT / "data" / "ltb_export.json"
MODEL_OUTPUTS_PATH = ROOT / "data" / "ltb_model_outputs.json"

# First 5 puzzles are the rare-language set targeted for LTB V2
LTB_PUZZLE_IDS = [
    "apurina-verb-agreement",
    "swahili-person-tense",
    "turkish-vowel-harmony",
    "quechua-person-endings",
    "nahuatl-both-ends",
]

LINGUISTICS: dict[str, list[str]] = {
    "apurina-verb-agreement": [
        "Morphological",
        "Verbal Inflection",
        "Person/Number Agreement",
        "Agglutinative",
    ],
    "swahili-person-tense": [
        "Morphological",
        "Verbal Inflection",
        "Person/Number Agreement",
        "Tense/Aspect",
    ],
    "turkish-vowel-harmony": [
        "Morphological",
        "Phonological",
        "Agglutinative",
        "Vowel Harmony",
    ],
    "quechua-person-endings": [
        "Morphological",
        "Verbal Inflection",
        "Person/Number Agreement",
        "Agglutinative",
    ],
    "nahuatl-both-ends": [
        "Morphological",
        "Verbal Inflection",
        "Person/Number Agreement",
    ],
}


def flat_morpheme_bank(morpheme_bank: list[list[str]]) -> list[str]:
    """Flatten grouped morpheme bank into a single tile list."""
    tiles: list[str] = []
    for group in morpheme_bank:
        tiles.extend(group)
    return tiles


def build_source_instructions(
    puzzle: dict[str, Any], query: dict[str, Any], tiles: list[str]
) -> str:
    """Build the full IOL few-shot context for LTB source_instructions."""
    evidence_lines = [f"- {row['source']} → {row['target']}" for row in puzzle["pairs"]]
    evidence_text = "\n".join(evidence_lines)

    hint_text = "\n".join(h["text"] for h in puzzle["hints"])

    return (
        "Given the following bilingual evidence pairs and a tile bank of morphemes, "
        "deduce the correct morpheme sequence for the query.\n\n"
        f"Evidence:\n{evidence_text}\n\n"
        f"Available morphemes: {', '.join(tiles)}\n\n"
        f"Hint:\n{hint_text}\n\n"
        f"Query: {query['prompt']}"
    )


def generate_verification_rules(
    puzzle: dict[str, Any], query: dict[str, Any], tiles: list[str]
) -> list[str]:
    """Generate objective verification rules from ground truth."""
    answer = query["answer"]
    rules = [
        f"Translation must use exactly {len(answer)} morpheme(s): {', '.join(repr(m) for m in answer)}.",
        f"Morphemes must appear in this exact order: {'-'.join(answer)}.",
        f"Translation must only use morphemes from the provided tile bank: {', '.join(tiles)}.",
        f"Translation must express the meaning: '{query['prompt']}'.",
    ]

    # Evidence consistency: find evidence rows that share any morpheme with the answer
    for row in puzzle["pairs"]:
        if any(m in row.get("morphemes", []) for m in answer):
            rules.append(
                f"Translation must be consistent with the evidence pattern: "
                f"'{row['source']}' → '{row['target']}'."
            )

    return rules


def verify_answer(
    answer: list[str], guess: list[str], rules: list[str], tiles: list[str]
) -> list[bool]:
    """Evaluate a morpheme guess against the verification rules."""
    exact = len(guess) == len(answer) and all(
        g == a for g, a in zip(guess, answer, strict=False)
    )
    in_bank = all(g in tiles for g in guess) if guess else False
    return [
        exact,  # exact morpheme match
        exact,  # order constraint (same as exact for morpheme sequences)
        in_bank,  # tile bank constraint
        exact,  # semantic constraint (assumed if exact)
        exact,  # evidence consistency (assumed if exact)
    ] + [exact] * max(0, len(rules) - 5)  # extra evidence rules default to exact


def infer_linguistics(puzzle: dict[str, Any]) -> list[str]:
    return LINGUISTICS.get(puzzle["id"], ["Morphological"])


def load_model_outputs() -> dict[str, list[dict[str, Any]]]:
    """Load per-query model translations keyed by 'puzzle_id:query_id'."""
    if not MODEL_OUTPUTS_PATH.exists():
        return {}
    with open(MODEL_OUTPUTS_PATH) as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def build_ltb_entry(
    puzzle: dict[str, Any],
    puzzle_index: int,
    query: dict[str, Any],
    query_index: int,
    model_outputs: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    tiles = flat_morpheme_bank(puzzle["morphemeBank"])
    rules = generate_verification_rules(puzzle, query, tiles)
    answer = query["answer"]

    translations: list[dict[str, Any]] = [
        {
            "model": "ratiocine_ground_truth",
            "translation": " ".join(answer),
            "verified": [True] * len(rules),
        }
    ]

    key = f"{puzzle['id']}:{query['id']}"
    for out in model_outputs.get(key, []):
        guess = out.get("answer", [])
        translations.append(
            {
                "model": out["model"],
                "translation": " ".join(guess) if guess else out.get("raw", ""),
                "verified": verify_answer(answer, guess, rules, tiles),
            }
        )

    return {
        "id": 10000 + puzzle_index * 100 + query["id"],
        "source_text": query["prompt"],
        "source_lang": "English",
        "target_lang": puzzle["language"],
        "source_lang_iso": "eng",
        "target_lang_iso": puzzle["languageCode"],
        "source_instructions": build_source_instructions(puzzle, query, tiles),
        "source_media": None,
        "translations": translations,
        "verification_rules": rules,
        "linguistics": infer_linguistics(puzzle),
        "attribution": f"https://ratiocine.trustfall.xyz/play?puzzle={puzzle['id']}",
        "tags": ["LTBv2", "IOL", "morphology", "rare-language", "few-shot"],
    }


def main():
    parser = argparse.ArgumentParser(description="Export Ratiocine puzzles to LTB V2")
    parser.add_argument(
        "--model-outputs",
        type=Path,
        default=MODEL_OUTPUTS_PATH,
        help="Path to model output JSON (default: data/ltb_model_outputs.json)",
    )
    args = parser.parse_args()

    with open(PUZZLES_PATH) as f:
        puzzles = json.load(f)

    model_outputs = (
        load_model_outputs() if args.model_outputs == MODEL_OUTPUTS_PATH else {}
    )
    if args.model_outputs != MODEL_OUTPUTS_PATH and args.model_outputs.exists():
        with open(args.model_outputs) as f:
            model_outputs = json.load(f)

    selected = [p for p in puzzles if p["id"] in LTB_PUZZLE_IDS]
    if not selected:
        selected = puzzles[:5]

    entries: list[dict[str, Any]] = []
    for p_idx, puzzle in enumerate(selected):
        for q in puzzle["queries"]:
            entries.append(build_ltb_entry(puzzle, p_idx, q, q["id"], model_outputs))

    with open(OUTPUT_PATH, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    logging.info("Exported %d LTB entries to %s", len(entries), OUTPUT_PATH)


if __name__ == "__main__":
    main()
