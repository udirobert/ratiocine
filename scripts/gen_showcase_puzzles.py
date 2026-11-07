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


VOWELS = set("aeiou")


def _pair_cell(p, meta):
    """Conditioning-cell signature for a evidence pair.

    Keeping every cell attested in the ungated set preserves solvability:
    the induction rule stays fully determined even though redundant rows
    are sealed.
    """
    fam = meta["family"]
    m = p["morphemes"]
    if fam in ("vharm", "vharmx"):
        root, ts = m[1], m[2]
        if fam == "vharmx":
            k = "F" if root[0] in meta["class_cons"] else "B"
        else:
            k = "F" if root[-1] in set(meta["front"]) else "B"
        tense = "pres" if ts[0] == meta["tense_cons"]["pres"] else "past"
        return (k, tense, len(m) == 4)
    if fam == "circ":
        noun, ts = m[0], m[3]
        tense = "pres" if ts == meta["tense_suf"]["pres"] else "past"
        return (meta["class_map"][noun], tense)
    if fam == "supp":
        prefix, stem, ts = m[0], m[1], m[2]
        pi = meta["persons"].index(prefix)
        group = "V" if pi in meta["vfinal"] else "C"
        tense = "pres" if ts[0] == meta["tcons"]["pres"] else "past"
        return (group, tense, "V" if stem[-1] in VOWELS else "C")
    return None


def select_ungated(puzzle):
    """Choose the minimal evidence cover that keeps the puzzle solvable.

    Ungated pairs must (a) attest every conditioning cell and (b) contain
    every morpheme used by any query answer. Pair 0 stays open — it is the
    tutorial query's source row ("this exact phrase is in the notes").
    Everything else is sealed behind the gated-specimens reveal.
    """
    meta = puzzle.get("_gen") or {}
    pairs = puzzle["pairs"]
    needed_morphs = {m for q in puzzle["queries"] for m in q["answer"]}

    covered_cells = set()
    covered_morphs = set()
    chosen = {0}
    covered_cells.add(_pair_cell(pairs[0], meta))
    covered_morphs.update(pairs[0]["morphemes"])

    def gain(i):
        p = pairs[i]
        cell = _pair_cell(p, meta)
        new_cell = cell is not None and cell not in covered_cells
        new_morphs = bool(set(p["morphemes"]) & (needed_morphs - covered_morphs))
        return (1 if new_cell else 0) + (1 if new_morphs else 0)

    while True:
        best, best_gain = -1, 0
        for i in range(len(pairs)):
            if i in chosen:
                continue
            g = gain(i)
            if g > best_gain:
                best, best_gain = i, g
        if best_gain == 0:
            break
        chosen.add(best)
        cell = _pair_cell(pairs[best], meta)
        if cell is not None:
            covered_cells.add(cell)
        covered_morphs.update(pairs[best]["morphemes"])

    for i, p in enumerate(pairs):
        p["gated"] = i not in chosen
    return len(chosen)


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
    select_ungated(puzzle)

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
        "family": puzzle["family"].replace("/", " · "),
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
                **({"gated": True} if p.get("gated") else {}),
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
            "etymology": f"'{puzzle['language']}' was "
            "recovered from a field notebook in the Specimen Archive — "
            "the linguist's grammar checks out, but no one ever heard it spoken.",
            "geography": "The Specimen Archive — Drawer 7",
            "speakers": "0 — it has never been spoken, only deduced",
            "family": f"{puzzle['family']} (synthetic)",
            "culturalNote": f"Every form of {puzzle['language']} was generated "
            "for this archive. There is no speaker to ask — only the evidence "
            "on the table and your induction.",
            "endangerment": "Cannot go extinct — it was never alive to begin with.",
            "funFact": info["funFact"],
            "briefingHook": f"{puzzle['language']} doesn't exist — which means "
            "your memory can't help. Only the evidence can.",
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
