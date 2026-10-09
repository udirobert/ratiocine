# Ratiocine Contribution to Last Translation Benchmark V2

Internal status + methods record. The outreach ask to the LTB team lives in
[`ltb-reviewer-note.md`](ltb-reviewer-note.md).

## What we are submitting

17 IOL-style few-shot morphological reasoning examples across 5 under-represented languages:

| Language | Family | Theme | Queries | ISO |
|----------|--------|-------|---------|-----|
| Apurinã | Arawakan | Verb agreement | 5 | apu |
| Swahili | Bantu | Person & tense | 3 | swa |
| Turkish | Turkic | Vowel harmony | 3 | tur |
| Quechua | Quechuan | Person endings | 3 | que |
| Nahuatl | Uto-Aztecan | Subject/object prefixation + suffixation | 3 | nah |

Each example is a single English prompt that must be translated by composing a morpheme sequence from an explicit tile bank. Ground truth is verified by exact morpheme match (EM), so the `verification_rules` are objective and reproducible.

## Why this is valuable for LTB V2

Most entries in LTB focus on translation *output* quality (figurative language, culture, false friends). Our examples target a different gap: **exact morphological composition** in low-resource and highly inflected languages. SOTA models often produce a plausible-looking word or a fluent literal translation while missing the precise affix order or morpheme identity required by the evidence. This makes the errors systematic and the rules easily verifiable.

The source language is always English; the target is always the puzzle language. The `source_instructions` field contains all the evidence needed to solve the problem, so reviewers can reproduce the expected reasoning without external resources.

## Model testing performed

All recorded answers are scored per query with `scripts/score_ltb_outputs.py`
(exact morpheme-sequence match against ground truth + failure-type
classification).

### Current sweep — 2026-10-09, `max_tokens=2048`

| Model | Lane | Score | Failure analysis |
|-------|------|-------|------------------|
| `openai/gpt-oss-120b` | Groq | **16 / 17** | Swahili "we sang" → `tulisimba` (gold `tu li imba`) |
| `qwen/qwen3.8-27b` | Groq | **16 / 17** | Swahili "we sang" → `tulimba` |
| `google/gemma-4-31b-it:free` | OpenRouter (throttled, partial 5/17) | 5 / 5 so far | none yet — notably solves #6107 `a pita ka` at the proper budget |

### First sweep — 2026-09, via Arkor, `max_tokens=512` (archived: `data/ltb_model_outputs_truncated20261009.json`)

| Model | Score | Failure analysis |
|-------|-------|------------------|
| `google/gemma-4-31b-it` | 15 / 17 | 1 truncation (harness); 1 **genuine**: Swahili "we sang" → `tulimba` |
| `google/gemini-3-8-flash` | 14 / 17 | 3 truncations (harness) — no valid modeling failures |

Completing the gemma (needs OpenRouter credits or a quieter hour on `:free`) and
gemini (needs credits or a Google AI Studio key) 2048-token re-sweeps is
pending.

Key takeaways:

1. **Swahili "we sang" → `tu li imba` now defeats every strong model that has met it — three of three**: GPT-OSS-120B (`tulisimba`), Qwen3.8-27B (`tulimba`), and Gemma 4 31B (`tulimba`) all output the orthographic word instead of the tile segmentation. Every other item in the set was solved by all three. Submitted entry #6106 is our strongest, most reproducible difficulty evidence.
2. **#6107 (Apurinã "he/she is going") has no failure evidence** — the September truncations were the harness; all three current-lane models solve it correctly. Either reposition #6107 as a well-formed but easier item or replace it before review concludes.
3. **Known confound:** `source_instructions` includes a hint naming the person prefix and verb roots. We measure *constrained composition under guidance*, not unscaffolded discovery. A no-hint variant is planned.
4. Free-tier lanes (Groq) make additional baselines nearly free — see Open actions.

## Submitted proof-of-concept examples

On 2026-09-09 the two strongest examples were submitted through the LTB contributor interface (https://last-translation-benchmark.vilda.net/contribute) and are pending review:

| # | Source → Target | Input | Human translation | Model evidence |
|---|-----------------|-------|-------------------|----------------|
| 6106 | English → Swahili | `we sang` | `tu li imba` | **All three strong models tested at proper budget fail**: GPT-OSS-120B → `tulisimba`, Qwen3.8-27B → `tulimba`, Gemma 4 31B → `tulimba` — segmentation blind spot, 3/3 |
| 6107 | English → Apurinã | `he/she is going` | `a pita ka` | GPT-OSS-120B, Qwen3.8-27B and Gemma all solve it at 2048 tokens — the Sept "truncation" misses were a harness artifact. **No difficulty evidence; consider repositioning or replacing** |

Do not describe #6107 as breaking any model until the re-run completes.

## Files and structure

- `data/puzzles.json` — exported puzzle pool from `showcase/app/play/puzzle-data.ts`
- `data/ltb_export.json` — 17 LTB-formatted entries with `translations`, `verification_rules`, and `linguistics` tags
- `data/ltb_model_outputs.json` — raw model answers per query (current sweep; entries carry `provider`)
- `data/ltb_model_outputs_truncated20261009.json` — archived Sept sweep at `max_tokens=512`
- `scripts/export_to_ltb.py` — converts puzzle data to `data/ltb_export.json`
- `scripts/llm_providers.py` — provider registry (arkor → openrouter → groq → google) with retry/failover + health probe CLI
- `scripts/run_models_for_ltb.py` — runs a sweep (default 2048 tokens) and records per-query outputs
- `scripts/score_ltb_outputs.py` — scores recorded outputs against ground truth; markdown table or `--json`; classifies each failure (truncation / parse artifact / evidence echo / segmentation-only / wrong answer)
- `docs/ltb-export-schema.md` — full format reference

## Attribution

All examples are credited to `https://ratiocine.trustfall.xyz/play?puzzle=<id>`.

## Open actions

1. Finish the 2048-token re-sweep for gemma (in progress on OpenRouter `:free`, throttled) and gemini (needs OpenRouter credits or a Google AI Studio key) — every recorded model should sit at the same token budget.
2. Add more free-lane baselines on Groq (`qwen/qwen3.8-27b` is next) and, if a Google key is added, Gemini via its OpenAI-compatible lane.
3. Get an independent linguist sign-off on the Apurinã segmentation (see reviewer note).
4. Scale from 17 to 25 problems (5 × 5) per the research roadmap.
5. Build the no-hint variant of `source_instructions` to remove the confound.
