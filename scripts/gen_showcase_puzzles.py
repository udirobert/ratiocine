#!/usr/bin/env python3
"""Convert generated puzzles into a showcase Puzzle[] TypeScript module.

Runs scripts/gen_puzzles.py across seeds and emits
showcase/app/play/gen-puzzles.ts — procedurally generated languages that
extend the daily rotation beyond the ten hand-built puzzles. Synthetic
languages get templated lore that is honest about being generated.

Usage:
    python3 scripts/gen_showcase_puzzles.py --seeds 200 201 --per-family 10 \
        --out showcase/app/play/gen-puzzles.ts
"""

import argparse
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import gen_puzzles as gp  # noqa: E402

THEMES = [
    {"accent": "#67e8f9", "sourceColor": "#a5f3fc", "bgTint": "#164e63"},
    {"accent": "#c4b5fd", "sourceColor": "#ddd6fe", "bgTint": "#4c1d95"},
    {"accent": "#86efac", "sourceColor": "#bbf7d0", "bgTint": "#14532d"},
    {"accent": "#fda4af", "sourceColor": "#fecdd3", "bgTint": "#881337"},
    {"accent": "#fcd34d", "sourceColor": "#fde68a", "bgTint": "#78350f"},
    {"accent": "#93c5fd", "sourceColor": "#bfdbfe", "bgTint": "#1e3a8a"},
]

FAMILY_INFO = {
    "vharm": {
        "difficulty": 4,
        "taskFrame": "Vowel harmony decides the shape of every suffix — including one that harmonizes with another suffix, not the root.",
        "verdicts": {
            "perfect": "The harmony propagated cleanly. Elegantly done.",
            "good": "Nearly flawless — one vowel slipped its class.",
            "partial": "Harmony is subtle. Watch which vowel each suffix copies.",
        },
        "funFact": "In this language, the question marker doesn't look at the root at all — it copies the tense suffix's vowel, a dependency that reaches two morphemes back.",
    },
    "circ": {
        "difficulty": 3,
        "taskFrame": "Nouns sort themselves into classes by their final sound — and verbs must agree with a prefix AND a suffix.",
        "verdicts": {
            "perfect": "Flawless agreement. The noun classes bow to you.",
            "good": "Strong solve — check the final sound of each noun.",
            "partial": "The class boundaries are phonological. Listen to how each noun ends.",
        },
        "funFact": "Agreement here is discontinuous: the verb wears a matching prefix and suffix, like a circumfix keyed to the noun's last phoneme.",
    },
    "supp": {
        "difficulty": 4,
        "taskFrame": "Two rules stack: verbs swap stems based on the subject prefix, and the tense suffix reshapes based on the stem.",
        "verdicts": {
            "perfect": "Both conditioned rules fired correctly. Sharp work.",
            "good": "Almost — one allomorph chose the wrong set.",
            "partial": "Two conditioning rules overlap here. Isolate them one at a time.",
        },
        "funFact": "This language suppletes: the same verb has two unrelated stems, and which one appears depends on how the subject prefix ends.",
    },
}


def build_warmup(puzzle):
    """Mirror buildTodayWarmup() from puzzle-data.ts."""
    q0 = puzzle["queries"][0]
    pairs = [
        {"source": p["source"], "target": p["target"]}
        for p in puzzle["pairs"]
        if not p.get("gated")
    ][:2]
    distractors = [
        q["answerJoined"]
        for q in puzzle["queries"][1:]
        if q["answerJoined"] != q0["answerJoined"]
    ][:2]
    choices = [q0["answerJoined"], *distractors]
    ordered = [choices[1], choices[0], choices[2]] if len(choices) == 3 else choices
    return {
        "pairs": pairs,
        "query": f'How do you say "{q0["prompt"]}"?',
        "answer": q0["answerJoined"],
        "choices": ordered,
    }


def convert(puzzle, seed, idx):
    meta = puzzle.get("_gen") or {}
    fam_key = meta.get("family") or "vharm"
    info = FAMILY_INFO.get(fam_key, FAMILY_INFO["vharm"])
    theme = THEMES[idx % len(THEMES)]
    script = " · ".join(p["source"] for p in puzzle["pairs"][:2])

    # languageCode must be unique per puzzle: it keys languagesCracked and
    # the map pins, and 3-letter prefixes collide across seeds
    code_b36 = ""
    n = idx + 1
    while n:
        code_b36 = "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36] + code_b36
        n //= 36
    return {
        "id": f"{puzzle['id']}-s{seed}",
        "language": puzzle["language"],
        "languageCode": puzzle["languageCode"] + code_b36,
        "family": puzzle["family"],
        "region": puzzle["region"],
        "taskType": puzzle["taskType"],
        "difficulty": info["difficulty"],
        "title": puzzle["title"],
        "instruction": puzzle["instruction"],
        "taskFrame": info["taskFrame"],
        "verdicts": info["verdicts"],
        "pairs": [
            {
                "id": i,
                "source": p["source"],
                "target": p["target"],
                "morphemes": p["morphemes"],
            }
            for i, p in enumerate(puzzle["pairs"])
        ],
        "queries": [
            {
                "id": q["id"],
                "prompt": q["prompt"],
                "answer": q["answer"],
                "answerJoined": q["answerJoined"],
                "difficulty": q["difficulty"],
                "hintOnFail": q.get("hintOnFail", ""),
                "flavor": q.get("flavor", ""),
            }
            for q in puzzle["queries"]
        ],
        "morphemeBank": puzzle["morphemeBank"],
        "hints": puzzle["hints"],
        "lore": {
            "etymology": f"'{puzzle['language']}' is a procedural construct — "
            "its name was generated by the same random process as its grammar.",
            "geography": "No real-world location — the language exists only in this puzzle.",
            "speakers": "Speaker count unknown — it is generated, not spoken.",
            "family": f"{puzzle['family']} (synthetic)",
            "culturalNote": f"Field notes for {puzzle['language']} were compiled "
            "entirely from generated data; every form is solvable from the "
            "evidence shown.",
            "endangerment": "Not applicable — a synthetic language cannot go extinct.",
            "funFact": info["funFact"],
            "briefingHook": f"Crack {puzzle['language']}: a language that has "
            "never been spoken, built so memorization can't help.",
            "lineageNote": "Generated by ratiocine's procedural grammar engine — "
            "contamination-proof by construction.",
            "coordinates": [0, 0],
        },
        "nextPreview": {
            "language": puzzle["language"],
            "script": script,
            "difficulty": info["difficulty"],
            "family": puzzle["family"],
            "theme": theme,
            "warmup": build_warmup(puzzle),
        },
        "theme": theme,
    }


def gen_for_seed(seed, per_family):
    rng = random.Random(seed)
    gens = [gp.gen_vharm, gp.gen_circ, gp.gen_supp]
    puzzles = []
    idx = 0
    for _ in range(per_family):
        for gfn in gens:
            puzzles.append(gfn(rng, idx))
            idx += 1
    return puzzles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, nargs="+", default=[200])
    ap.add_argument("--per-family", type=int, default=10)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    converted = []
    flat_idx = 0
    for seed in args.seeds:
        for puzzle in gen_for_seed(seed, args.per_family):
            converted.append(convert(puzzle, seed, flat_idx))
            flat_idx += 1

    out = Path(args.out)
    body = json.dumps(converted, indent=1, ensure_ascii=False)
    out.write_text(
        "// GENERATED by scripts/gen_showcase_puzzles.py — do not hand-edit.\n"
        "// Procedurally generated languages (vharm / circ / supp families).\n\n"
        'import type { Puzzle } from "./puzzle-data";\n\n'
        f"export const GEN_PUZZLES: Puzzle[] = {body};\n"
    )
    print(f"wrote {len(converted)} puzzles -> {out}")


if __name__ == "__main__":
    main()
