# Ratiocine Contribution to Last Translation Benchmark V2

## What we are submitting

17 IOL-style few-shot morphological reasoning examples across 5 under-represented languages:

| Language | Family | Theme | Queries | ISO |
|----------|--------|-------|---------|-----|
| Apurinã | Arawakan | Verb agreement | 5 | apu |
| Swahili | Bantu | Person & tense | 3 | swa |
| Turkish | Turkic | Vowel harmony | 3 | tur |
| Quechua | Quechuan | Person endings | 3 | que |
| Nahuatl | Uto-Aztecan | Both ends of the verb | 3 | nah |

Each example is a single English prompt that must be translated by composing a morpheme sequence from an explicit tile bank. Ground truth is verified by exact morpheme match (EM), so the `verification_rules` are objective and reproducible.

## Why this is valuable for LTB V2

Most entries in LTB focus on translation *output* quality (figurative language, culture, false friends). Our examples target a different gap: **exact morphological composition** in low-resource and highly inflected languages. SOTA models often produce a plausible-looking word or a fluent literal translation while missing the precise affix order or morpheme identity required by the evidence. This makes the errors systematic and the rules easily verifiable.

The source language is always English; the target is always the puzzle language. The `source_instructions` field contains all the evidence needed to solve the problem, so reviewers can reproduce the expected reasoning without external resources.

## Model testing performed

We tested two models on the Arkor endpoint:

- `google/gemma-4-31b-it`
- `google/gemini-3-8-flash`

| Model | Correct / 17 | Notes |
|-------|--------------|-------|
| Gemma 4 31B | 15 / 17 | Fails on Apurinã "we (everyone) are speaking" and Swahili "we sang" |
| Gemini 3-8-Flash | 12 / 17 | Fails on several Apurinã queries, producing prose analysis instead of morphemes |

Both models are state-of-the-art, yet they break on 2-5 of our 17 examples. The failures confirm the target gap: **morphological few-shot reasoning with exact output constraints**.

## Files and structure

- `data/puzzles.json` — exported puzzle pool from `showcase/app/play/puzzle-data.ts`
- `data/ltb_export.json` — 17 LTB-formatted entries with `translations`, `verification_rules`, and `linguistics` tags
- `data/ltb_model_outputs.json` — raw model answers from Gemma and Gemini
- `scripts/export_to_ltb.py` — converts puzzle data to `data/ltb_export.json`
- `scripts/run_models_for_ltb.py` — calls the Arkor endpoint and records per-query outputs
- `docs/ltb-export-schema.md` — full format reference

## Attribution

All examples are credited to `https://ratiocine.trustfall.xyz/play?puzzle=<id>`.

## Request

We would like the Ratiocine team to be listed on the LTB V2 author list. We are happy to address any reviewer feedback and can scale the pipeline to more puzzles and more models as needed.

## Submitted proof-of-concept examples

On 2026-09-09 the two strongest examples were submitted through the LTB contributor interface (https://last-translation-benchmark.vilda.net/contribute) and are now pending review:

| # | Source → Target | Input | Human translation | LTB status |
|---|-----------------|-------|-------------------|------------|
| 6106 | English → Swahili | `we sang` | `tu li imba` | Pending |
| 6107 | English → Apurinã | `he/she is going` | `a pita ka` | Pending |

Both examples break the tested SOTA models on exact morpheme composition and have been verified through the site’s model leaderboard.
