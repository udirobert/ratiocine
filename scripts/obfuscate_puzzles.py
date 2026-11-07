#!/usr/bin/env python3
"""Generate an obfuscated variant of data/puzzles.json.

LingOly-TOO-style reasoning-equivariant obfuscation (disclosed prior art):
each puzzle's target-language orthography is replaced by a consistent
bijection at the character level, so no string can be recognised from
pre-training data. English glosses, instructions and metadata are untouched.

Vowel-class characters map to vowel-like symbols and consonants to
consonant-like symbols, preserving the partition structure that vowel-harmony
and morphophonological puzzles depend on. The mapping is a bijection, so
equality/inequality patterns between forms are fully preserved.

Usage:
    python3 scripts/obfuscate_puzzles.py --seed 1 \
        --output eval-hackathon/data/puzzles_obf_1.json
"""

import argparse
import json
import random
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUZZLES_PATH = ROOT / "data" / "puzzles.json"

# Replacement pools: uncommon letters that no model has memorised as
# orthography for any real language. Vowel pool stays vowel-like so
# harmony classes remain visually inferable; consonant pool likewise.
VOWEL_POOL = list("ɐɛɪɔʊʌəɤɯɨʉøœæɞʚɵɘɶ")
CONS_POOL = list("ƀƃƌƍƒɠɣɦɧɫɬɮɱɲɳɴɸɹɺɻɽɾʀʁʂʃʈʋʍʎʐʑʒθðħŧɓɗʄʛʜʝʟʠʡ")
PUNCT = set("-–—'’.,;:!?()[]{} \t\n")


def base_char(ch: str) -> str:
    """Decompose to base letter (ş -> s, ã -> a)."""
    return unicodedata.normalize("NFD", ch)[0]


def is_vowel(ch: str) -> bool:
    return base_char(ch).lower() in "aeiouy"


def collect_chars(puzzle: dict) -> set[str]:
    chars: set[str] = set()

    def add(s: str) -> None:
        for ch in s:
            if ch not in PUNCT:
                chars.add(ch)

    for pair in puzzle["pairs"]:
        add(pair["source"])
        for m in pair.get("morphemes", []):
            add(m)
    for group in puzzle["morphemeBank"]:
        for m in group:
            add(m)
    for q in puzzle["queries"]:
        for m in q["answer"]:
            add(m)
        add(q.get("answerJoined", ""))
    for h in puzzle.get("hints", []):
        rm = h.get("revealMorpheme")
        if rm:
            add(rm.get("morpheme", ""))
    return chars


def build_mapping(puzzle_id: str, chars: set[str], seed: int) -> dict[str, str]:
    rng = random.Random(f"{seed}:{puzzle_id}")
    vowels = sorted(c for c in chars if is_vowel(c))
    cons = sorted(c for c in chars if not is_vowel(c))
    vp = VOWEL_POOL[:]
    cp = CONS_POOL[:]
    rng.shuffle(vp)
    rng.shuffle(cp)
    if len(vp) < len(vowels) or len(cp) < len(cons):
        raise RuntimeError(
            f"pool too small for {puzzle_id}: vowels {len(vowels)}>{len(VOWEL_POOL)}, "
            f"cons {len(cons)}>{len(CONS_POOL)}"
        )
    mapping = {c: vp[i] for i, c in enumerate(vowels)}
    mapping.update({c: cp[i] for i, c in enumerate(cons)})
    # Sanity: bijection onto distinct symbols
    assert len(set(mapping.values())) == len(mapping)
    return mapping


def obfuscate_text(s: str, mapping: dict[str, str]) -> str:
    return "".join(mapping.get(ch, ch) for ch in s)


def obfuscate_puzzle(puzzle: dict, mapping: dict[str, str], seed: int) -> dict:
    out = json.loads(json.dumps(puzzle))  # deep copy
    for pair in out["pairs"]:
        pair["source"] = obfuscate_text(pair["source"], mapping)
        if "morphemes" in pair:
            pair["morphemes"] = [obfuscate_text(m, mapping) for m in pair["morphemes"]]
    out["morphemeBank"] = [
        [obfuscate_text(m, mapping) for m in group] for group in out["morphemeBank"]
    ]
    for q in out["queries"]:
        q["answer"] = [obfuscate_text(m, mapping) for m in q["answer"]]
        if q.get("answerJoined"):
            q["answerJoined"] = obfuscate_text(q["answerJoined"], mapping)
    for h in out.get("hints", []):
        rm = h.get("revealMorpheme")
        if rm and rm.get("morpheme"):
            rm["morpheme"] = obfuscate_text(rm["morpheme"], mapping)
    out["obfuscation"] = {
        "method": "per-character bijection, vowel/consonant class preserving",
        "seed": seed,
        "note": "English glosses and metadata unchanged; target-language "
        "strings replaced by symbols that cannot appear in training data.",
    }
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--input", type=Path, default=PUZZLES_PATH)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    puzzles = json.loads(args.input.read_text())
    out_puzzles = []
    all_maps = {}
    for puzzle in puzzles:
        chars = collect_chars(puzzle)
        mapping = build_mapping(puzzle["id"], chars, args.seed)
        all_maps[puzzle["id"]] = mapping
        out_puzzles.append(obfuscate_puzzle(puzzle, mapping, args.seed))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out_puzzles, ensure_ascii=False, indent=1))
    maps_path = args.output.with_suffix(".maps.json")
    maps_path.write_text(json.dumps(all_maps, ensure_ascii=False, indent=1))
    print(
        f"wrote {args.output} ({len(out_puzzles)} puzzles, seed={args.seed}); "
        f"mappings -> {maps_path}"
    )
