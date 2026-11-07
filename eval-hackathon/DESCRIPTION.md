# Morphology Induction Eval — short description

**What it measures:** whether frontier LLMs can induce the grammar of a
language they've never seen — from bare bilingual evidence, with no
morpheme bank handed to them.

**Why it matters:** every linguistics-style eval to date hands models a
scaffold (a morpheme inventory, a worked example, a fixed template). That
scaffold silently carries the score. We built languages that do not exist —
procedurally generated grammars with random morphemes, random phoneme
inventories, and conditioned rules (vowel harmony, noun-class agreement,
conditioned suppletion, polypersonal agreement) — so memorization is
impossible by construction, and we can dial difficulty by seed.

**What we found:**

- With the scaffold, frontier models are near-perfect (~0.95–1.00 EM) —
  even when the orthography is ciphered or evidence is minimized. The
  scaffold is the hidden variable in linguistics evals.
- On generated languages with conditioned grammar, the frontier pack
  splits: gemini-3.1-pro 0.97, gpt-5.6 0.90, claude-opus-4.8 0.73,
  qwen3-next-80b 0.28. Errors concentrate exactly on conditioned structure —
  wrong suppletive stem, wrong harmony allomorph, wrong agreement slot —
  the right frame with the wrong variant.
- On real olympiad problems (Linguini/IOL), *every* model sits at
  0.43–0.63 EM. The limitation isn't morphology per se — it's discovering
  the structure of the problem itself.

**Reproducibility:** deterministic generator (`scripts/gen_puzzles.py`),
deterministic graders, stored raw generations for every model call
(re-grade for $0 via `regrade.py`), grader audit (42/42 gold pass,
0/19 corrupted false-passes), seedable datasets so judges can generate
fresh held-out languages. Stdlib-only aggregation.

**Submission contents:** `eval-hackathon/` — runners for 6 providers,
puzzle generators (3 grammar families + hard profile), graders,
per-family failure taxonomy, full results tables, this description,
report, and video script.
