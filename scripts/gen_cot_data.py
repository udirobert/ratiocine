#!/usr/bin/env python3
"""Generate CoT training data from procedural novel-language puzzles.

Emits data/synthetic/gen_cot_train.jsonl in the iol_cot_train chat format
(system + user + assistant with <analysis>/<answers>), where each example is
one query from a generated puzzle (vharm / circ / supp families).

The <analysis> is rendered deterministically from the generator's own rule
metadata (_gen), so every trace cites the actual allomorphs and conditioning
factors of that puzzle — teaching conditioned-morphology induction rather than
memorized answers. Training seeds must stay disjoint from eval seeds
(gen1/2/3 used seeds 7/11/23); default range starts at 100.

Usage:
    python3 scripts/gen_cot_data.py --start-seed 100 --seeds 6 --per-family 20 \
        --out data/synthetic/gen_cot_train.jsonl
"""

import argparse
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))

import gen_puzzles as gp  # noqa: E402
from prompts import get_system_prompt  # noqa: E402
from run_models_for_ltb import build_context  # noqa: E402

VOWELS = set("aeiou")
SUBJ2PERSON = {v: k for k, v in gp.PERSON_SUBJ.items()}
PERSONS = gp.PERSONS


def gen_puzzles_for_seed(seed: int, per_family: int):
    rng = random.Random(seed)
    gens = [gp.gen_vharm, gp.gen_circ, gp.gen_supp]
    puzzles = []
    idx = 0
    for _ in range(per_family):
        for gfn in gens:
            puzzles.append(gfn(rng, idx))
            idx += 1
    return puzzles


def split_subject(prompt: str):
    """Return (subject_en, rest) splitting on the longest known subject."""
    for subj in sorted(gp.PERSON_SUBJ.values(), key=len, reverse=True):
        if prompt.startswith(subj + " "):
            return subj, prompt[len(subj) + 1 :]
    return None, prompt


def parse_verb_form(form: str, verbs):
    """Map an English verb form back to (verb, tense) using generator helpers."""
    for v in verbs:
        if form == gp.past(v):
            return v, "past"
    for v in verbs:
        if form in (v, gp.pres3(v)):
            return v, "pres"
    return None, None


def parse_vharm_prompt(prompt: str, meta):
    """Return dict(person, verb, tense, question) or None."""
    question = prompt.endswith("?")
    body = prompt.rstrip("?")
    aux_tense = None
    for aux, t in (("Did ", "past"), ("Does ", "pres"), ("Do ", "pres")):
        if body.startswith(aux):
            body = body[len(aux) :]
            aux_tense = t
            break
    subj_en, rest = split_subject(body)
    if subj_en is None:
        return None
    verb, tense = parse_verb_form(rest.strip(), set(meta["root_verb"].values()))
    if verb is None:
        return None
    if aux_tense:
        tense = aux_tense
    return {
        "person": SUBJ2PERSON[subj_en],
        "verb": verb,
        "tense": tense,
        "question": question,
    }


def analyze_vharm(query, meta):
    parsed = parse_vharm_prompt(query["prompt"], meta)
    if parsed is None:
        return None
    pi = PERSONS.index(parsed["person"])
    prefix = meta["persons"][pi]
    verb_verb = parsed["verb"]
    root = next(r for r, v in meta["root_verb"].items() if v == verb_verb)
    tense = parsed["tense"]
    question = parsed["question"]

    front = set(meta["front"])
    last_v = root[-1]
    cls = "front" if last_v in front else "back"
    hv = meta["fv"] if cls == "front" else meta["bv"]
    ts = meta["tense_cons"][tense] + hv

    morphs = list(query["answer"])
    expected = [prefix, root, ts]
    if question:
        qv = meta["qv_f"] if hv in front else meta["qv_b"]
        qen = meta["q_cons"] + qv
        expected.append(qen)
    if morphs != expected:
        return None

    subj_en = gp.PERSON_SUBJ[parsed["person"]]
    steps = [
        f"The prompt '{query['prompt']}' is "
        f"{'a question' if question else 'a statement'}: subject '{subj_en}', "
        f"verb '{verb_verb}', {tense}.",
        f"Subject prefixes are invariant across tense and question: "
        f"'{prefix}' marks '{parsed['person']}' (the same prefix appears "
        f"throughout the pairs).",
        f"'{root}' is the root for '{verb_verb}' — roots are invariant stems.",
        f"The tense suffix is a tense consonant plus a harmonized vowel. "
        f"'{root}' ends in '{last_v}', a {cls} vowel, so the suffix vowel "
        f"harmonizes to '{hv}': '{meta['tense_cons'][tense]}' + '{hv}' "
        f"= '{ts}'.",
    ]
    if question:
        qv = meta["qv_f"] if hv in front else meta["qv_b"]
        qen = meta["q_cons"] + qv
        steps.append(
            f"The question enclitic does NOT look at the root — it harmonizes "
            f"with the tense suffix's vowel '{hv}' ({'front' if hv in front else 'back'} "
            f"class): '{meta['q_cons']}' + '{qv}' = '{qen}'. This is a "
            f"long-distance dependency two morphemes back."
        )
    steps.append(
        f"Order is prefix + root + tense + (question): "
        f"{' '.join(morphs)} → '{query['answerJoined']}'."
    )
    return steps


def analyze_circ(query, meta):
    m = re.match(
        r"'([^']+)' means 'the [^']+'\.\s*Translate the verb '([^']+)'", query["prompt"]
    )
    if not m:
        return None
    stem, form = m.group(1), m.group(2)
    # classify by final sound
    if stem[-1] == meta["finals"]["nasal"]:
        kind = "nasal"
    elif stem[-1] == meta["finals"]["stop"]:
        kind = "stop"
    else:
        kind = "vowel"
    cls = {"nasal": "A", "vowel": "B", "stop": "C"}[kind]
    found = None
    for root, v in meta["vr_verb"].items():
        if form == gp.pres3(v):
            found = (root, v, "pres")
            break
        if form == gp.past(v):
            found = (root, v, "past")
            break
    if found is None:
        return None
    vroot, verb, tense = found

    morphs = list(query["answer"])
    expected = [
        meta["agr_p"][cls],
        vroot,
        meta["tense_suf"][tense],
        meta["agr_s"][cls],
    ]
    if morphs != expected:
        return None

    noun_en = meta["noun_map"].get(stem, stem)
    steps = [
        f"The prompt supplies noun stem '{stem}' ('the {noun_en}') and asks for "
        f"the verb '{form}' as it agrees with that noun.",
        f"Agreement class is conditioned by the noun's FINAL SOUND: '{stem}' "
        f"ends in '{stem[-1]}', a {kind} → class {cls}. Every class-{cls} "
        f"subject triggers the same circumfix in the pairs: prefix "
        f"'{meta['agr_p'][cls]}' before the root and suffix '{meta['agr_s'][cls]}' "
        f"after the tense marker.",
        f"'{vroot}' is the root for '{verb}'; the {tense} tense suffix is "
        f"'{meta['tense_suf'][tense]}'.",
        f"Verb template: agr-prefix + root + tense + agr-suffix → "
        f"{' '.join(morphs)} = '{query['answerJoined']}'.",
    ]
    return steps


def analyze_supp(query, meta):
    subj_en, rest = split_subject(query["prompt"])
    if subj_en is None:
        return None
    pi = PERSONS.index(SUBJ2PERSON[subj_en])
    form = rest.strip().rstrip(".")
    verbs = [v for _, _, v in meta["stems"]]
    parsed = parse_verb_form(form, verbs)
    if parsed[0] is None:
        return None
    verb, tense = parsed

    prefix = meta["persons"][pi]
    a, b = next((a, b) for a, b, v in meta["stems"] if v == verb)
    use_a = pi in meta["vfinal"]
    stem = a if use_a else b
    v = meta["tv"][tense] if stem[-1] in VOWELS else meta["tc"][tense]
    ts = meta["tcons"][tense] + v

    morphs = list(query["answer"])
    expected = [prefix, stem, ts]
    if morphs != expected:
        return None

    pfinal = "a vowel" if prefix[-1] in VOWELS else "a consonant"
    sfinal = "a vowel" if stem[-1] in VOWELS else "a consonant"
    steps = [
        f"'{query['prompt']}' = subject '{subj_en}' + verb '{verb}' in {tense}.",
        f"Subject prefix '{prefix}' ends in {pfinal}. The language has "
        f"conditioned suppletion: prefixes ending in a vowel take stem set A, "
        f"prefixes ending in a consonant take stem set B (both sets are "
        f"attested for every verb in the pairs).",
        f"'{verb}' has two stems: A='{a}', B='{b}'. This subject takes set "
        f"{'A' if use_a else 'B'} → '{stem}'.",
        f"Tense-suffix allomorphy is conditioned by the STEM's final sound: "
        f"'{stem}' ends in {sfinal}, so the {tense} suffix uses the "
        f"{'vowel' if stem[-1] in VOWELS else 'consonant'}-final allomorph "
        f"set: '{meta['tcons'][tense]}' + '{v}' = '{ts}'.",
        f"Order: prefix + stem + tense suffix → "
        f"{' '.join(morphs)} = '{query['answerJoined']}'.",
    ]
    return steps


ANALYZERS = {"vharm": analyze_vharm, "circ": analyze_circ, "supp": analyze_supp}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-seed", type=int, default=100)
    ap.add_argument("--seeds", type=int, default=6)
    ap.add_argument("--per-family", type=int, default=20)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--variant",
        default="no_hint",
        choices=["default", "no_hint", "decomposition", "no_bank"],
    )
    args = ap.parse_args()

    system = get_system_prompt("translation")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    n_puz = n_ex = n_skip = 0
    with out.open("w") as f:
        for seed in range(args.start_seed, args.start_seed + args.seeds):
            for puzzle in gen_puzzles_for_seed(seed, args.per_family):
                meta = puzzle.get("_gen")
                if not meta:
                    continue
                analyzer = ANALYZERS.get(meta["family"])
                if analyzer is None:
                    continue
                n_puz += 1
                for query in puzzle["queries"]:
                    steps = analyzer(query, meta)
                    if steps is None:
                        n_skip += 1
                        continue
                    context = build_context(puzzle, query, args.variant)
                    user = f"{context}\n\n{query['prompt']}"
                    assistant = (
                        "<analysis>\n" + "\n".join(steps) + "\n</analysis>\n"
                        "<answers>\n" + query["answerJoined"] + "\n</answers>"
                    )
                    f.write(
                        json.dumps(
                            {
                                "messages": [
                                    {"role": "system", "content": system},
                                    {"role": "user", "content": user},
                                    {"role": "assistant", "content": assistant},
                                ]
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    n_ex += 1
    print(f"wrote {n_ex} examples from {n_puz} puzzles -> {out} ({n_skip} skipped)")


if __name__ == "__main__":
    main()
