#!/usr/bin/env python3
"""Convert our IOL puzzles into Last Translation Benchmark V2 entries."""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from run_models_for_ltb import (  # noqa: E402
    DECOMPOSITION_INSTRUCTION,
    surface_forms,
)
from score_ltb_outputs import classify_failure, grade  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")

# Completions our serving lane failed to produce, as opposed to answers a model
# gave that happen to be wrong. Only real answers belong in an LTB entry.
LANE_FAILURES = {"lane_failure", "truncated_output", "parse_artifact", "evidence_echo"}
NOTE = {
    "unsegmented_surface_form": (
        "correct translation of the decomposition, written as the fused surface "
        "form rather than spaced morphemes"
    ),
    "wrong_answer": "matches neither the decomposition nor any accepted surface form of it",
}


def over_segmented(answer: list[str], guess: list[str], tiles: list[str]) -> list[str]:
    """Tiles in the guess that swallow a required morpheme instead of using it.

    Asked for bare morphemes, a model reaches for the lexeme `taka` where the gold
    wants the aspect suffix `ka` that `taka` contains — the reverse of the fused
    surface form being punished, and the reason the two are labelled apart.
    """
    return [
        g
        for g in guess
        if g not in answer and g in tiles and any(a != g and a in g for a in answer)
    ]


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
        f"Query: {query['prompt']}\n\n" + DECOMPOSITION_INSTRUCTION
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

    rules.append(
        "Accepted alternative spellings of this decomposition (joined, and joined "
        "with vowel elision at morpheme boundaries): "
        f"{', '.join(sorted(surface_forms(answer)))}. A response equal to one of "
        "these is a correct translation that failed to segment — score the meaning "
        "correct and the format incorrect."
    )
    return rules


def verify_answer(
    answer: list[str],
    guess: list[str],
    rules: list[str],
    tiles: list[str],
    joined: str = "",
) -> list[bool]:
    """Evaluate a morpheme guess against the verification rules.

    The rules split in two. Morpheme identity, order and tile-bank membership are
    about *segmentation*; the meaning rule and the evidence-consistency rules are
    about *translation*. A fused attested surface form (`tulimba`) fails the first
    group and satisfies the second, so it is graded that way — marking it wrong on
    "must express the meaning: 'we sang'" is the scoring artifact we retracted in
    September, reproduced inside the export.
    """
    exact = len(guess) == len(answer) and all(
        g == a for g, a in zip(guess, answer, strict=False)
    )
    surface = bool(joined) and joined in surface_forms(answer)
    meaning_ok = exact or surface
    in_bank = all(g in tiles for g in guess) if guess else False
    out = [exact, exact, in_bank, meaning_ok]
    out += [meaning_ok] * max(0, len(rules) - 1 - len(out))  # evidence-consistency
    out.append(surface)  # the accepted-spellings rule is its own question
    return out


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
            "surface_forms": sorted(surface_forms(answer)),
            "verified": [True] * len(rules),
        }
    ]

    key = f"{puzzle['id']}:{query['id']}"
    info = {
        "gold": " ".join(answer),
        "gold_morphs": answer,
        "evidence": {row["target"] for row in puzzle["pairs"]},
        "tiles": tiles,
    }
    by_answer: dict[tuple[str, str], dict[str, Any]] = {}
    for out in model_outputs.get(key, []):
        guess = out.get("answer", [])
        answer_text = out.get("answer_text") or " ".join(guess)
        joined = answer_text.replace(" ", "").replace("-", "")
        variant = out.get("prompt_variant") or "default"
        decomp, surface = grade(info, answer_text, guess)
        failure = (
            None
            if decomp
            else classify_failure(
                info, out.get("raw", ""), answer_text, surface, variant
            )
        )
        if failure in LANE_FAILURES:
            # A blank or truncated completion is our serving lane failing, not a
            # translation. Shipping it as one would misreport the model.
            continue
        entry = by_answer.get((out["model"], joined))
        if entry is None:
            by_answer[(out["model"], joined)] = entry = {
                "model": out["model"],
                "translation": " ".join(guess) if guess else answer_text,
                "prompt_variants": [],
                "verified": verify_answer(answer, guess, rules, tiles, joined),
            }
            if not decomp:
                entry["note"] = NOTE.get(failure, failure)
                if failure == "wrong_answer":
                    swallowed = over_segmented(answer, guess, tiles)
                    if swallowed:
                        entry["note"] = (
                            f"over-segmented: uses the tile(s) {', '.join(repr(s) for s in swallowed)} "
                            "where the gold requires the morpheme(s) they contain — "
                            "the error a spaced-morpheme instruction induces"
                        )
        if variant not in entry["prompt_variants"]:
            entry["prompt_variants"].append(variant)

    translations.extend(by_answer.values())

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
    parser.add_argument(
        "--out",
        type=Path,
        default=OUTPUT_PATH,
        help="Where to write the export (default: data/ltb_export.json)",
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

    with open(args.out, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
        f.write("\n")

    logging.info("Exported %d LTB entries to %s", len(entries), args.out)


if __name__ == "__main__":
    main()
