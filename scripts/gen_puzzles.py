#!/usr/bin/env python3
"""Generate novel-language morphology puzzles (procedural, seedable).

Three grammar families, each isolating a different induction skill:

  vharm — vowel harmony + long-distance harmony. Tense suffix harmonizes
          with the root's last vowel; a question enclitic harmonizes with
          the *tense suffix's* vowel (two-step induction).
  circ  — discontinuous agreement. Verb carries a prefix+suffix circumfix
          determined by the subject noun's final sound (phonologically
          conditioned noun-class agreement).
  supp  — conditioned suppletion + allomorphy. Verb stem has two
          allomorphs chosen by the subject prefix's final sound; tense
          suffix allomorphy conditioned by stem-final sound.

Every puzzle is a language that does not exist: random morphemes, random
phoneme inventories, random class assignments. Contamination-proof by
construction. Output is puzzles.json-compatible.

Usage: python3 scripts/gen_puzzles.py --seed 7 --per-family 6 \
         --out eval-hackathon/data/puzzles_gen1.json
"""

import argparse
import json
import random
from pathlib import Path

CONS = "ptkmnslrwj"
VOWELS = "aeiou"
PERSONS = ["I", "you", "he", "we", "you-pl", "they"]
PERSON_SUBJ = {
    "I": "I",
    "you": "you",
    "he": "he",
    "we": "we",
    "you-pl": "you all",
    "they": "they",
}
VERBS = [
    "walk",
    "talk",
    "jump",
    "play",
    "wait",
    "call",
    "help",
    "watch",
    "cook",
    "clean",
    "carry",
    "smile",
]
NOUNS = [
    "cat",
    "dog",
    "bird",
    "fish",
    "lion",
    "bear",
    "goat",
    "deer",
    "wolf",
    "frog",
    "crab",
    "newt",
]


def past(verb: str) -> str:
    if verb.endswith("e"):
        return verb + "d"
    if verb.endswith("y") and len(verb) > 1 and verb[-2] not in "aeiou":
        return verb[:-1] + "ied"
    if verb.endswith("y"):
        return verb + "ed"
    return verb + "ed"


def pres3(verb: str) -> str:
    if verb.endswith("y") and verb[-2] not in "aeiou":
        return verb[:-1] + "ies"
    if verb.endswith(("s", "x", "ch", "sh")):
        return verb + "es"
    return verb + "s"


def qform(person: str, verb: str, tense: str) -> str:
    if tense == "past":
        return f"Did {PERSON_SUBJ[person]} {verb}?"
    return f"{'Does' if person == 'he' else 'Do'} {PERSON_SUBJ[person]} {verb}?"


def stmt(person: str, verb: str, tense: str) -> str:
    base = verb if tense == "pres" else past(verb)
    if person == "he" and tense == "pres":
        return f"{PERSON_SUBJ[person]} {pres3(verb)}"
    return f"{PERSON_SUBJ[person]} {base}"


def syl(rng, cons, vows, n_c=1, n_v=1):
    return "".join(rng.choice(cons) + rng.choice(vows) for _ in range(max(n_c, n_v)))


def cvcv(rng, cons, vows):
    return rng.choice(cons) + rng.choice(vows) + rng.choice(cons) + rng.choice(vows)


def fake_lang(rng, idx):
    name = "".join(syl(rng, CONS, VOWELS) for _ in range(3))
    return {
        "id": f"gen-{idx:03d}",
        "language": name.capitalize(),
        "languageCode": "Q" + name[:3],
        "family": "Generated",
        "region": "Synthetic",
        "taskType": "morphology",
        "title": f"{name.capitalize()} field notes",
        "instruction": "Deduce the grammar and translate.",
        "difficulty": "hard",
    }


def make_bank(*groups):
    return [sorted(set(g)) for g in groups if g]


def emit(puzzle, pairs, queries, bank_groups, lore="", meta=None):
    puzzle["pairs"] = pairs
    puzzle["queries"] = queries
    if meta is not None:
        puzzle["_gen"] = meta
    puzzle["morphemeBank"] = make_bank(*bank_groups)
    puzzle["hints"] = [
        {
            "level": 1,
            "type": "highlight",
            "text": "Compare minimal pairs to isolate each morpheme.",
        }
    ]
    puzzle["lore"] = lore
    puzzle["nextPreview"] = ""
    puzzle["theme"] = "synthetic"
    puzzle["verdicts"] = {}
    return puzzle


def pair(src_morphs, gloss):
    return {
        "source": "".join(src_morphs),
        "target": gloss,
        "morphemes": list(src_morphs),
    }


def query(qid, gloss, morphs, joined, diff, flavor=""):
    return {
        "id": qid,
        "prompt": gloss,
        "answer": list(morphs),
        "answerJoined": joined,
        "difficulty": diff,
        "flavor": flavor,
        "hintOnFail": "",
    }


# ---------------------------------------------------------------- VHARM


def gen_vharm(rng, idx):
    p = fake_lang(rng, idx)
    p["family"] = "Generated/vowel-harmony"
    front = set(rng.sample(["i", "e"], 2))
    back = set(rng.sample(["a", "o", "u"], 2))
    allv = sorted(front | back)
    cons = "".join(rng.sample(CONS, 7))
    fv = rng.choice(sorted(front))
    bv = rng.choice(sorted(back))
    # question enclitic uses a (possibly different) realization per class
    qv_f = rng.choice(sorted(front - {fv}) or sorted(front))
    qv_b = rng.choice(sorted(back - {bv}) or sorted(back))

    def harm(v):
        return fv if v in front else bv

    persons = [syl(rng, cons, allv) for _ in range(6)]
    persons = [x if x[-1] not in allv else x + rng.choice(cons) for x in persons]
    persons = [x[:2] + rng.choice(cons) + x[2:] if len(x) == 2 else x for x in persons]
    # ensure unique, CVC-ish prefixes
    seen = set()
    for i, x in enumerate(persons):
        while x in seen or len(x) < 3:
            x = cvcv(rng, cons, allv)[:3]
        seen.add(x)
        persons[i] = x

    roots, verbs = [], rng.sample(VERBS, 8)
    while True:
        roots = []
        for v in verbs:
            r = cvcv(rng, cons, allv)
            while r in roots:
                r = cvcv(rng, cons, allv)
            roots.append(r)
        # harmony induction needs both classes attested
        if any(r[-1] in front for r in roots) and any(r[-1] in back for r in roots):
            break
    root_verb = dict(zip(roots, verbs))

    tense_cons = {"pres": rng.choice(cons), "past": rng.choice(cons)}
    q_cons = rng.choice(cons)

    def build(person_i, root, tense, is_q):
        last_v = root[-1]
        hv = harm(last_v)
        ts = tense_cons[tense] + hv
        morphs = [persons[person_i], root, ts]
        if is_q:
            qv = qv_f if hv in front else qv_b
            morphs.append(q_cons + qv)
        return morphs

    def gloss(person_i, root, tense, is_q):
        return (
            qform(PERSONS[person_i], root_verb[root], tense)
            if is_q
            else stmt(PERSONS[person_i], root_verb[root], tense)
        )

    # evidence: cover persons x tenses x q x both harmony classes
    combos = []
    for pi in range(6):
        for ti, tense in enumerate(["pres", "past"]):
            for q in (False, True):
                combos.append((pi, ti, q))
    rng.shuffle(combos)
    ev_idx = set()
    roots_by_class = {
        "F": [r for r in roots if r[-1] in front],
        "B": [r for r in roots if r[-1] in back],
    }
    # ensure both classes represented
    picked = []
    # guarantee every person prefix is attested in evidence
    for pi in range(6):
        r = rng.choice(roots)
        picked.append((pi, r, rng.choice(["pres", "past"]), rng.random() < 0.4))

    # guarantee every (harmony-class x tense x question) cell is attested
    def cell(pi, r, t, q):
        return ("F" if r[-1] in front else "B", t, q)

    need = {(c, t, q) for c in "FB" for t in ("pres", "past") for q in (False, True)}
    have = {cell(*c4) for c4 in picked}
    for c in sorted(need - have):
        klass, t, q = c
        rlist = roots_by_class[klass]
        pi = rng.randrange(6)
        cand = (pi, rlist[0], t, q)
        if cand not in picked:
            picked.append(cand)
        have.add(c)
    # guarantee every root is attested (root <-> English verb mapping)
    for r in roots:
        if not any(c[1] == r for c in picked):
            picked.append(
                (rng.randrange(6), r, rng.choice(["pres", "past"]), rng.random() < 0.4)
            )
    while len(picked) < 20:
        pi = rng.randrange(6)
        r = rng.choice(roots)
        t = rng.choice(["pres", "past"])
        q = rng.random() < 0.4
        cand = (pi, r, t, q)
        if cand not in picked:
            picked.append(cand)
    picked = picked[:22]

    pairs = [pair(build(pi, r, t, q), gloss(pi, r, t, q)) for pi, r, t, q in picked]

    # queries: held-out combos; tutorial = exact copy of an evidence row
    qitems = []
    ev_set = {(pi, r, t, q) for pi, r, t, q in picked}
    cands = [
        (pi, r, t, q)
        for pi in range(6)
        for r in roots
        for t in ("pres", "past")
        for q in (False, True)
        if (pi, r, t, q) not in ev_set
    ]
    rng.shuffle(cands)
    # 1 tutorial (copy of evidence), 4 standard, 2 curveball (rare class+q)
    t_pi, t_r, t_t, t_q = picked[0]
    qitems.append(
        query(
            0,
            gloss(t_pi, t_r, t_t, t_q),
            build(t_pi, t_r, t_t, t_q),
            "".join(build(t_pi, t_r, t_t, t_q)),
            "tutorial",
            "Free — this exact phrase is in the notes.",
        )
    )
    qi = 1
    used = set()
    for pi, r, t, q in cands[:4]:
        used.add((pi, r, t, q))
        m = build(pi, r, t, q)
        qitems.append(query(qi, gloss(pi, r, t, q), m, "".join(m), "standard"))
        qi += 1
    # curveball: question forms (long-distance harmony) on held-out roots
    q_cands = [c for c in cands if c[3] and c[0] in (1, 4, 5) and c not in used]
    pool = q_cands or [c for c in cands if c not in used]
    for pi, r, t, q in pool[:2]:
        m = build(pi, r, t, q)
        qitems.append(
            query(
                qi,
                gloss(pi, r, t, q),
                m,
                "".join(m),
                "curveball",
                "Watch the question marker's vowel.",
            )
        )
        qi += 1

    bank = (
        persons,
        roots,
        sorted(
            {tense_cons["pres"] + harm(r[-1]) for r in roots}
            | {tense_cons["past"] + harm(r[-1]) for r in roots}
        ),
        [q_cons + qv_f, q_cons + qv_b],
    )
    return emit(
        p,
        pairs,
        qitems,
        bank,
        lore=f"{p['language']} verbs mark tense and questions with vowel harmony.",
        meta={
            "family": "vharm",
            "persons": persons,
            "root_verb": root_verb,
            "front": sorted(front),
            "back": sorted(back),
            "fv": fv,
            "bv": bv,
            "qv_f": qv_f,
            "qv_b": qv_b,
            "tense_cons": tense_cons,
            "q_cons": q_cons,
        },
    )


# ------------------------------------------------------- VHARMX (hard mode)


def gen_vharmx(rng, idx):
    """Vowel harmony conditioned on an arbitrary consonant class.

    Same long-distance structure as vharm, but the harmony class is not
    recoverable from vowel quality: a root belongs to class F iff its INITIAL
    consonant is in a random subset of the inventory. Models must induce a
    consonant partition from the suffix alternations alone — the phonetic
    'front/back vowel' shortcut is gone.
    """
    p = fake_lang(rng, idx)
    p["family"] = "Generated/consonant-class-harmony"
    front = set(rng.sample(["i", "e"], 2))
    back = set(rng.sample(["a", "o", "u"], 2))
    allv = sorted(front | back)
    cons = "".join(rng.sample(CONS, 7))
    fv = rng.choice(sorted(front))
    bv = rng.choice(sorted(back))
    qv_f = rng.choice(sorted(front - {fv}) or sorted(front))
    qv_b = rng.choice(sorted(back - {bv}) or sorted(back))
    # arbitrary subset of the consonant inventory defines class F
    class_cons = set(rng.sample(cons, rng.choice([3, 4])))

    def klass(root):
        return "F" if root[0] in class_cons else "B"

    def hv_for(root):
        return fv if klass(root) == "F" else bv

    persons = [syl(rng, cons, allv) for _ in range(6)]
    persons = [x if x[-1] not in allv else x + rng.choice(cons) for x in persons]
    persons = [x[:2] + rng.choice(cons) + x[2:] if len(x) == 2 else x for x in persons]
    seen = set()
    for i, x in enumerate(persons):
        while x in seen or len(x) < 3:
            x = cvcv(rng, cons, allv)[:3]
        seen.add(x)
        persons[i] = x

    verbs = rng.sample(VERBS, 8)
    while True:
        roots = []
        for v in verbs:
            r = cvcv(rng, cons, allv)
            while r in roots:
                r = cvcv(rng, cons, allv)
            roots.append(r)
        # both consonant classes must be attested for the rule to be learnable
        if {klass(r) for r in roots} == {"F", "B"}:
            break
    root_verb = dict(zip(roots, verbs))

    tense_cons = {"pres": rng.choice(cons), "past": rng.choice(cons)}
    q_cons = rng.choice(cons)

    def build(person_i, root, tense, is_q):
        hv = hv_for(root)
        ts = tense_cons[tense] + hv
        morphs = [persons[person_i], root, ts]
        if is_q:
            qv = qv_f if hv in front else qv_b
            morphs.append(q_cons + qv)
        return morphs

    def gloss(person_i, root, tense, is_q):
        return (
            qform(PERSONS[person_i], root_verb[root], tense)
            if is_q
            else stmt(PERSONS[person_i], root_verb[root], tense)
        )

    picked = []
    for pi in range(6):
        r = rng.choice(roots)
        picked.append((pi, r, rng.choice(["pres", "past"]), rng.random() < 0.4))

    roots_by_class = {"F": [], "B": []}
    for r in roots:
        roots_by_class[klass(r)].append(r)

    def cell(pi, r, t, q):
        return (klass(r), t, q)

    need = {(c, t, q) for c in "FB" for t in ("pres", "past") for q in (False, True)}
    have = {cell(*c4) for c4 in picked}
    for c in sorted(need - have):
        k, t, q = c
        rlist = roots_by_class[k]
        pi = rng.randrange(6)
        cand = (pi, rlist[0], t, q)
        if cand not in picked:
            picked.append(cand)
        have.add(c)
    for r in roots:
        if not any(c[1] == r for c in picked):
            picked.append(
                (rng.randrange(6), r, rng.choice(["pres", "past"]), rng.random() < 0.4)
            )
    while len(picked) < 20:
        pi = rng.randrange(6)
        r = rng.choice(roots)
        t = rng.choice(["pres", "past"])
        q = rng.random() < 0.4
        cand = (pi, r, t, q)
        if cand not in picked:
            picked.append(cand)
    picked = picked[:22]

    pairs = [pair(build(pi, r, t, q), gloss(pi, r, t, q)) for pi, r, t, q in picked]

    qitems = []
    ev_set = {(pi, r, t, q) for pi, r, t, q in picked}
    cands = [
        (pi, r, t, q)
        for pi in range(6)
        for r in roots
        for t in ("pres", "past")
        for q in (False, True)
        if (pi, r, t, q) not in ev_set
    ]
    rng.shuffle(cands)
    t_pi, t_r, t_t, t_q = picked[0]
    qitems.append(
        query(
            0,
            gloss(t_pi, t_r, t_t, t_q),
            build(t_pi, t_r, t_t, t_q),
            "".join(build(t_pi, t_r, t_t, t_q)),
            "tutorial",
            "Free — this exact phrase is in the notes.",
        )
    )
    qi = 1
    used = set()
    for pi, r, t, q in cands[:4]:
        used.add((pi, r, t, q))
        m = build(pi, r, t, q)
        qitems.append(query(qi, gloss(pi, r, t, q), m, "".join(m), "standard"))
        qi += 1
    q_cands = [c for c in cands if c[3] and c[0] in (1, 4, 5) and c not in used]
    pool = q_cands or [c for c in cands if c not in used]
    for pi, r, t, q in pool[:2]:
        m = build(pi, r, t, q)
        qitems.append(
            query(
                qi,
                gloss(pi, r, t, q),
                m,
                "".join(m),
                "curveball",
                "The harmony class hides in the first consonant, not the vowels.",
            )
        )
        qi += 1

    bank = (
        persons,
        roots,
        sorted(
            {tense_cons["pres"] + fv, tense_cons["pres"] + bv}
            | {tense_cons["past"] + fv, tense_cons["past"] + bv}
        ),
        [q_cons + qv_f, q_cons + qv_b],
    )
    return emit(
        p,
        pairs,
        qitems,
        bank,
        lore=f"{p['language']} verbs mark tense and questions with harmony "
        f"conditioned on the root's initial consonant.",
        meta={
            "family": "vharmx",
            "persons": persons,
            "root_verb": root_verb,
            "front": sorted(front),
            "back": sorted(back),
            "fv": fv,
            "bv": bv,
            "qv_f": qv_f,
            "qv_b": qv_b,
            "tense_cons": tense_cons,
            "q_cons": q_cons,
            "class_cons": sorted(class_cons),
        },
    )


# ---------------------------------------------------------------- CIRC


def gen_circ(rng, idx):
    p = fake_lang(rng, idx)
    p["family"] = "Generated/noun-class-agreement"
    cons = "".join(rng.sample(CONS, 8))
    allv = VOWELS
    # noun classes conditioned on final sound: nasal / vowel / stop
    finals = {"nasal": rng.choice("mn"), "vowel": None, "stop": rng.choice("ptk")}
    class_of_final = {"nasal": "A", "vowel": "B", "stop": "C"}

    def noun_stem(kind, final_kind):
        body = cvcv(rng, cons, allv)
        if final_kind == "nasal":
            return body + finals["nasal"]
        if final_kind == "stop":
            return body + finals["stop"]
        return body + rng.choice("aeiou")

    nouns = []  # (stem, english, final_kind)
    en = rng.sample(NOUNS, 9)
    kinds = ["nasal", "vowel", "stop"] * 3
    rng.shuffle(kinds)
    for i, k in enumerate(kinds):
        nouns.append((noun_stem(None, k), en[i], k))
    noun_map = {s: e for s, e, _ in nouns}
    class_map = {s: class_of_final[k] for s, e, k in nouns}

    vroots = []
    verbs_en = rng.sample(VERBS, 6)
    for v in verbs_en:
        r = cvcv(rng, cons, allv)
        while r in vroots:
            r = cvcv(rng, cons, allv)
        vroots.append(r)
    vr_verb = dict(zip(vroots, verbs_en))

    # agreement: per class a prefix AND a suffix (circumfix), per tense a suffix
    agr_p = {c: syl(rng, cons, allv) for c in "ABC"}
    agr_s = {c: syl(rng, cons, allv) for c in "ABC"}
    while len(set(agr_s.values())) < 3:
        for c in "ABC":
            agr_s[c] = syl(rng, cons, allv)
    tense_suf = {
        "pres": rng.choice(cons) + rng.choice(allv),
        "past": rng.choice(cons) + rng.choice(allv),
    }

    def build(noun, vroot, tense):
        c = class_map[noun]
        return [noun, agr_p[c], vroot, tense_suf[tense], agr_s[c]]

    def gloss(noun, vroot, tense):
        v = vr_verb[vroot]
        base = v if tense == "pres" else past(v)
        if tense == "pres":
            base = pres3(v)
        return f"the {noun_map[noun]} {base}"

    combos = [(n, v, t) for n, _, _ in nouns for v in vroots for t in ("pres", "past")]
    # guarantee: every verb root attested, every class x tense cell attested
    picked = []
    for v in vroots:
        n = rng.choice(nouns)[0]
        picked.append((n, v, rng.choice(["pres", "past"])))
    need = {(c, t) for c in "ABC" for t in ("pres", "past")}
    have = {(class_map[n], t) for n, v, t in picked}
    for c, t in sorted(need - have):
        n = next(nn[0] for nn in nouns if class_map[nn[0]] == c)
        v = rng.choice(vroots)
        cand = (n, v, t)
        if cand not in picked:
            picked.append(cand)
    while len(picked) < 18:
        cand = (rng.choice(nouns)[0], rng.choice(vroots), rng.choice(["pres", "past"]))
        if cand not in picked:
            picked.append(cand)
    picked = picked[:18]

    def vgloss(vroot, tense):
        v = vr_verb[vroot]
        return pres3(v) if tense == "pres" else past(v)

    def qprompt(noun, vroot, tense):
        return (
            f"'{noun}' means 'the {noun_map[noun]}'. "
            f"Translate the verb '{vgloss(vroot, tense)}' "
            f"as it agrees with this noun."
        )

    pairs = []
    for n, v, t in picked:
        m = build(n, v, t)
        src = n + " " + "".join(m[1:])
        pairs.append({"source": src, "target": gloss(n, v, t), "morphemes": m})

    ev_set = set(picked)
    qitems = []

    # verb-only answers: [agr_p, vroot, tense_suf, agr_s]
    def vbuild(noun, vroot, tense):
        c = class_map[noun]
        return [agr_p[c], vroot, tense_suf[tense], agr_s[c]]

    t_n, t_v, t_t = picked[0]
    vm = vbuild(t_n, t_v, t_t)
    qitems.append(
        query(
            0,
            qprompt(t_n, t_v, t_t),
            vm,
            "".join(vm),
            "tutorial",
            "This exact verb form is in the notes.",
        )
    )
    qi = 1
    # queries may use ANY noun (stem given in prompt) — held-out nouns
    # force phonological class induction rather than memorized pairs
    nq = list(nouns)
    rest = [
        (n[0], v, t)
        for n in nq
        for v in vroots
        for t in ("pres", "past")
        if (n[0], v, t) not in ev_set
    ]
    rng.shuffle(rest)
    used = set()
    for n, v, t in rest[:5]:
        used.add((n, v, t))
        vm = vbuild(n, v, t)
        qitems.append(query(qi, qprompt(n, v, t), vm, "".join(vm), "standard"))
        qi += 1
    rare = [
        c for c in rest if class_map[c[0]] == "C" and c[2] == "past" and c not in used
    ]
    pool = rare or [c for c in rest if c not in used]
    for n, v, t in pool[:2]:
        vm = vbuild(n, v, t)
        qitems.append(
            query(
                qi,
                qprompt(n, v, t),
                vm,
                "".join(vm),
                "curveball",
                "Does the verb 'know' what kind of noun it has?",
            )
        )
        qi += 1

    bank = (
        list(noun_map),
        list(agr_p.values()),
        vroots,
        list(agr_s.values()),
        list(tense_suf.values()),
    )
    return emit(
        p,
        pairs,
        qitems,
        bank,
        lore=f"{p['language']} verbs agree with their subject noun "
        f"by a matching prefix and suffix.",
        meta={
            "family": "circ",
            "class_map": class_map,
            "finals": finals,
            "noun_map": noun_map,
            "vr_verb": vr_verb,
            "agr_p": agr_p,
            "agr_s": agr_s,
            "tense_suf": tense_suf,
        },
    )


# ---------------------------------------------------------------- SUPP


def gen_supp(rng, idx):
    p = fake_lang(rng, idx)
    p["family"] = "Generated/conditioned-suppletion"
    cons = "".join(rng.sample(CONS, 8))
    allv = VOWELS

    persons = []
    seen = set()
    while len(persons) < 6:
        x = cvcv(rng, cons, allv)
        if x not in seen:
            seen.add(x)
            persons.append(x)
    # make half the prefixes end in a vowel, half in a consonant
    vfinal = [i for i, x in enumerate(persons) if x[-1] in allv]
    cfinal = [i for i, x in enumerate(persons) if x[-1] not in allv]
    if not vfinal or not cfinal:
        persons[0] = persons[0][:-1] + rng.choice("aeiou")
        persons[1] = persons[1][:-1] + rng.choice(cons)
        vfinal = [i for i, x in enumerate(persons) if x[-1] in allv]
        cfinal = [i for i, x in enumerate(persons) if x[-1] not in allv]

    verbs_en = rng.sample(VERBS, 8)
    stems = []  # (stemA, stemB, english)
    for v in verbs_en:
        a = cvcv(rng, cons, allv)
        b = cvcv(rng, cons, allv)
        while b == a:
            b = cvcv(rng, cons, allv)
        stems.append((a, b, v))

    # tense suffix allomorphs conditioned by stem-final sound:
    # stems ending vowel take suffix set V, consonant take set C
    tcons = {"pres": rng.choice(cons), "past": rng.choice(cons)}
    tv = {"pres": rng.choice(allv), "past": rng.choice(allv)}
    tc = {"pres": rng.choice(allv), "past": rng.choice(allv)}

    def stem_for(pi, a, b):
        # suppletion conditioned by prefix final sound
        return a if pi in vfinal else b

    def tense_suf(stem, tense):
        v = tv[tense] if stem[-1] in allv else tc[tense]
        return tcons[tense] + v

    def build(pi, a, b, tense):
        s = stem_for(pi, a, b)
        return [persons[pi], s, tense_suf(s, tense)]

    def gloss(pi, v_en, tense):
        return stmt(PERSONS[pi], v_en, tense)

    combos = [
        (pi, si, t)
        for pi in range(6)
        for si in range(len(stems))
        for t in ("pres", "past")
    ]
    # guarantee: every person attested; every verb shows BOTH stem
    # allomorphs (one vowel-final-prefix row, one consonant-final row)
    picked = []
    for pi in range(6):
        picked.append((pi, rng.randrange(len(stems)), rng.choice(["pres", "past"])))
    for si in range(len(stems)):
        for grp in (vfinal, cfinal):
            pi = rng.choice(grp)
            cand = (pi, si, rng.choice(["pres", "past"]))
            if cand not in picked:
                picked.append(cand)
    for t in ("pres", "past"):
        if not any(c[2] == t for c in picked):
            picked.append((rng.choice(vfinal), 0, t))
    while len(picked) < 20:
        cand = (
            rng.randrange(6),
            rng.randrange(len(stems)),
            rng.choice(["pres", "past"]),
        )
        if cand not in picked:
            picked.append(cand)
    picked = picked[:22]
    pairs = [
        pair(build(pi, stems[si][0], stems[si][1], t), gloss(pi, stems[si][2], t))
        for pi, si, t in picked
    ]

    ev_set = set(picked)
    qitems = []
    pi0, si0, t0 = picked[0]
    a0, b0, v0 = stems[si0]
    m0 = build(pi0, a0, b0, t0)
    qitems.append(
        query(
            0,
            gloss(pi0, v0, t0),
            m0,
            "".join(m0),
            "tutorial",
            "This exact phrase is in the notes.",
        )
    )
    qi = 1
    rest = [c for c in combos if c not in ev_set]
    rng.shuffle(rest)
    used = set()
    for pi, si, t in rest[:5]:
        used.add((pi, si, t))
        a, b, v = stems[si]
        m = build(pi, a, b, t)
        qitems.append(query(qi, gloss(pi, v, t), m, "".join(m), "standard"))
        qi += 1
    # curveball: 3rd-person (he/they) suppletive stem + past tense
    cb = [c for c in rest if c[0] in (2, 5) and c[2] == "past" and c not in used]
    pool = cb or [c for c in rest if c not in used]
    for pi, si, t in pool[:2]:
        a, b, v = stems[si]
        m = build(pi, a, b, t)
        qitems.append(
            query(
                qi,
                gloss(pi, v, t),
                m,
                "".join(m),
                "curveball",
                "Two things change here — check both.",
            )
        )
        qi += 1

    all_stems = sorted({s for a, b, _ in stems for s in (a, b)})
    bank = (
        persons,
        all_stems,
        sorted(
            {tcons[t] + tv[t] for t in ("pres", "past")}
            | {tcons[t] + tc[t] for t in ("pres", "past")}
        ),
    )
    return emit(
        p,
        pairs,
        qitems,
        bank,
        lore=f"{p['language']} verbs have two stems chosen by the "
        f"subject prefix's final sound.",
        meta={
            "family": "supp",
            "persons": persons,
            "vfinal": vfinal,
            "cfinal": cfinal,
            "stems": stems,
            "tcons": tcons,
            "tv": tv,
            "tc": tc,
        },
    )


# ---------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--per-family", type=int, default=6)
    ap.add_argument(
        "--profile",
        choices=["std", "hard"],
        default="std",
        help="hard swaps vharm for vharmx (consonant-class harmony)",
    )
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    puzzles = []
    harmony = gen_vharmx if args.profile == "hard" else gen_vharm
    gens = [("vharm", harmony), ("circ", gen_circ), ("supp", gen_supp)]
    idx = 0
    for fam_i in range(args.per_family):
        for gname, gfn in gens:
            puzzles.append(gfn(rng, idx))
            idx += 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(puzzles, indent=1, ensure_ascii=False))
    nq = sum(len(p["queries"]) for p in puzzles)
    print(f"wrote {len(puzzles)} puzzles, {nq} queries -> {out}")


if __name__ == "__main__":
    main()
