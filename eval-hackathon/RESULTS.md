# Results — Morpheme Induction + Linguini evals

All numbers below are computed by `aggregate.py` / the Linguini runner over
raw generations stored in `results/`. Custom-puzzle metrics exclude
`tutorial` queries (those copy evidence verbatim). Linguini metrics are
per-item means over all answered sub-questions.

> **Status**: custom-puzzle sweep complete (all models × 3 conditions);
> Linguini frontier runs still completing — those rows are marked.

## 1. Custom Morpheme Induction Eval (10 puzzles, 42 scored queries/run)

Conditions: `canonical` (original orthography), `obf1` (per-character
bijection on target language, seed 1), `shuf1` (evidence rows permuted,
seed 1). Prompt variant `no_hint` throughout (interactive hints reveal
answers and are excluded from the eval).

| Model | Condition | Trials | EM-surf | EM-decomp | chrF | morf1 | consistency | pass^k-all |
|---|---|---|---|---|---|---|---|---|
| claude-opus-4-8 | canonical | 3 | 0.938 | 0.938 | 0.947 | 0.979 | 0.938 | 0.906 |
| claude-opus-4-8 | obf1 | 3 | 0.948 | 0.948 | 0.932 | 0.977 | 0.948 | 0.906 |
| claude-opus-4-8 | shuf1 | 1 | 0.969 | 0.969 | 0.950 | 0.990 | 0.969 | 0.969 |
| gemini-3-1-pro | canonical | 3 | 1.000 | 1.000 | 0.953 | 1.000 | 1.000 | 1.000 |
| gemini-3-1-pro | obf1 | 3 | 0.969 | 0.969 | 0.939 | 0.984 | 0.969 | 0.969 |
| gemini-3-1-pro | shuf1 | 1 | 1.000 | 1.000 | 0.953 | 1.000 | 1.000 | 1.000 |
| gpt-5-6-sol | canonical | 3 | 1.000 | 1.000 | 0.953 | 1.000 | 1.000 | 1.000 |
| gpt-5-6-sol | obf1 | 3 | 1.000 | 1.000 | 0.953 | 1.000 | 1.000 | 1.000 |
| gpt-5-6-sol | shuf1 | 1 | 1.000 | 1.000 | 0.953 | 1.000 | 1.000 | 1.000 |
| gpt-oss-120b | canonical | 3 | 0.979 | 0.979 | 0.945 | 0.984 | 0.979 | 0.938 |
| gpt-oss-120b | obf1 | 3 | 0.990 | 0.990 | 0.945 | 0.990 | 0.990 | 0.969 |
| gpt-oss-120b | shuf1 | 1 | 0.969 | 0.969 | 0.947 | 0.990 | 0.969 | 0.969 |
| openai/gpt-oss-120b | canonical | 3 | 0.990 | 0.990 | 0.951 | 0.997 | 0.990 | 0.969 |
| openai/gpt-oss-120b | obf1 | 1* | 0.933 | 0.933 | 0.916 | 0.950 | 0.933 | 0.933 |
| qwen/qwen3.8-27b | canonical | 1 | 1.000 | 1.000 | 0.948 | 1.000 | 1.000 | 1.000 |
| qwen3-next-80b-a3b-instruct | canonical | 3 | 0.979 | 0.979 | 0.939 | 0.979 | 0.979 | 0.938 |
| qwen3-next-80b-a3b-instruct | obf1 | 3 | 0.934 | 0.934 | 0.893 | 0.943 | 0.948 | 0.875 |

`*` = groq arm truncated by the provider's daily token limit; one obf
trial survives (39/42 queries). `openai/gpt-oss-120b` canonical includes
one unlabeled early run counted as a third trial. `qwen/qwen3.8-27b` is
a single canonical trial (groq).

| Model | Condition | Trials | EM-surf | EM-decomp | chrF | morf1 | consistency | pass^k-all |
|---|---|---|---|---|---|---|---|---|
| claude-opus-4-8 | min1 | 3 | 0.885 | 0.896 | 0.942 | 0.965 | 0.896 | 0.844 |
| gemini-3-1-pro | min1 | 3 | 0.969 | 0.969 | 0.948 | 0.990 | 0.969 | 0.969 |
| gpt-5-6-sol | min1 | 3 | 0.969 | 0.969 | 0.948 | 0.990 | 0.969 | 0.969 |
| qwen3-next-80b-a3b-instruct | min1 | 3 | 0.833 | 0.833 | 0.879 | 0.914 | 0.833 | 0.781 |

`min1` = minimal evidence cover (`scripts/make_min_pairs.py`): the
smallest subset of evidence pairs that still attests every morpheme the
queries need (pairs cut ~8–10 → 2–8 per puzzle). Even at minimal
evidence, frontier EM stays ≥0.83 — the scaffolded task is solved at
any evidence budget we can construct while keeping gold well-defined.

**Headline**: frontier models essentially solve the scaffolded task —
obfuscation and evidence reduction both cost them little. Where they do
fail it is *systematic*, not random (see Failure analysis). The real
limitation appears on un-scaffolded/generated material (§2–§3).

## 2. Linguini (IOL benchmark, 160 problems / 894 questions)

Frontier models on raw, un-scaffolded IOL problems. Scores are
post-`regrade_linguni.py` (recovers answers models emit outside the
`<answers>` protocol; missing answers count as wrong).

| Model | Problems done | EM | chrF | geo score |
|---|---|---|---|---|
| claude-opus-4-8 | 160/160 | 0.434 | 0.590 | 0.506 |
| gpt-5-6-sol | 160/160 | 0.598 | 0.649 | 0.623 |
| gemini-3-1-pro | 160/160 | 0.633 | 0.618 | 0.625 |
| openai/gpt-oss-120b | 3/160 (aborted, groq TPD) | — | — | — |

claude-opus-4-8 by task type: `fill_blanks` 0.470, `match_letters`
0.532, `translation` 0.405, `num_to_text` 0.407, `text_to_num` 0.211.
gemini-3-1-pro: `fill_blanks` 0.379, `match_letters` 0.942 (high EM but
chrF 0.235 — near-miss letter ordering), `num_to_text` 0.481,
`text_to_num` 0.526, `translation` 0.579.

## 3. Generated languages (PRIMARY)

Procedurally generated languages that do not exist — random morphemes,
random phoneme inventories, three grammar families (`scripts/gen_puzzles.py`).
Contamination is impossible by construction.

**`puzzles_gen3.json` (seed 23, clean primary set: 24 puzzles / 184
queries, evidence coverage verified)** — EM-decomp, 2 trials:

| Model | Overall | vowel-harmony | noun-class | suppletion |
|---|---|---|---|---|
| claude-opus-4-8 | **0.725** | 0.760 | 0.804 | 0.616 |
| gpt-5-6-sol | 0.903 | 0.938 | 0.964 | 0.812 |
| gemini-3-1-pro | 0.966 | 0.958 | 0.982 | 0.955 |
| qwen3-next-80b-a3b-instruct | **0.278** | 0.271 | 0.312 | 0.250 |

**Earlier seeds (corroboration; ~7% underdetermined items found and
fixed in gen3, so scores are conservative lower bounds):**

| Seed | claude | gpt-5-6-sol | gemini-3-1-pro |
|---|---|---|---|
| gen1 (18 puzzles) | 0.683 | 0.729 | 0.767 |
| gen2 (30 puzzles) | 0.662 | 0.787 | 0.805 |

Failure taxonomy on gen3 (`analyze_failures.py`): claude's errors are
36% wrong suppletive stem (suppletion), 20% harmony allomorph
(vowel-harmony), 13%+4% agreement prefix/suffix (noun-class) — models
produce the right frame with the wrong conditioned variant. Gemini's
error rate is ~4% everywhere. Qwen3-Next (open 80B) collapses to 0.278 —
a mix of format non-compliance (verbose reasoning emitted instead of
morpheme sequences) and genuine allomorph errors, showing the eval
discriminates across the full capability spectrum.

## 4. Grader audit

- Gold answers pass: **42/42** (all three surface notations: spaced,
  joined, `answerJoined`).
- Deliberately corrupted decompositions: **0/19 false passes**.
- Normalization collisions between distinct golds: **0**.
- Parser fixes applied during the eval (all verified against stored raw
  generations, no re-spend): morpheme-boundary recovery inside
  whitespace tokens, verbatim-before-stripped bank segmentation
  (hyphenated tiles), unicode dash normalization, unterminated
  `<answers>` recovery, vowel-elision-aware segmentation.
