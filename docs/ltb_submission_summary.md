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

Each example is a single English prompt that must be answered by composing a morpheme sequence from an explicit tile bank. The required output format is now stated in `source_instructions` and the accepted surface spellings are listed in `verification_rules`, because grading a spaced decomposition against a prompt that asks for the word measures the harness rather than the model.

## Why this is valuable for LTB V2

Most entries in LTB focus on translation *output* quality (figurative language, culture, false friends). Our examples target a different gap: **exact morphological composition** in low-resource and highly inflected languages, graded deterministically from a tile bank with no judge in the loop.

What our own ablation adds is a warning about how such an item should be specified. Under a prompt that asks for the target-language word, a model that produces the correct fused form (`tulimba`) is scored wrong; under a prompt that demands spaced morphemes, models produce correct segmentations but a *new* error appears (an over-segmented `taka` for the aspect suffix `ka`). Both are format effects, and both were invisible until we scored the two axes separately. The contribution to LTB V2 is this measurement-design result plus a set of items whose rules are objective and reproducible — not a claim that any item defeats current models.

The source language is always English; the target is always the puzzle language. The `source_instructions` field contains all the evidence needed to solve the problem, so reviewers can reproduce the expected reasoning without external resources.

## Model testing performed

All recorded answers are graded twice, per query, by `scripts/score_ltb_outputs.py`:

- **EM_decomp** — the answer equals the tile decomposition (`tu li imba`).
- **EM_surface** — the answer equals an attested *surface* spelling of that
  decomposition, including the vowel-elided form (`tulimba`).

A gap between the two columns is an output-format effect, not a reasoning
failure, so the report keeps them apart. Three prompt arms are recorded against
the same items:

- `default` — the stock IOL prompt, which asks for "the EXACT target-language
  form" and never mentions segmentation.
- `decomposition` — same prompt plus one explicit line requiring
  space-separated morphemes from the tile bank.
- `no_hint` — the `default` prompt with the hint block withheld, to test whether
  the scaffold is doing the work.

### Side-by-side result (2026-10-10, `max_tokens=2048`, 17 items per arm at most)

| Model | Arm | Items | EM_decomp | EM_surface | What the misses are |
|-------|-----|-------|-----------|------------|---------------------|
| `openai/gpt-oss-120b` | default | 17 | 16/17 | 16/17 | Swahili #6106 → `tulisimba` (wrong formation) |
| `openai/gpt-oss-120b` | decomposition | 17 | **17/17** | **17/17** | none |
| `openai/gpt-oss-120b` | no_hint | 17 | 16/17 | **17/17** | only miss is unsegmented `tulimba` |
| `qwen/qwen3.8-27b` | default | 17 | 16/17 | **17/17** | #6106 → `tulimba`: correct translation, scored wrong on format |
| `qwen/qwen3.8-27b` | decomposition | 15 | 12/15 | 12/15 | Apurinã ×3 over-segmented `…taka`; 2 items lost to Groq 429 |
| `qwen/qwen3.8-27b` | no_hint | 16 | 16/16 | 16/16 | clean; 1 item lost to Groq 429 |
| `Qwen/Qwen3-32B` | decomposition | 17 | 13/17 | 13/17 | 1 Featherless lane failure + 1 `…taka` + **2 Turkish harmony errors** → 13/16 answered |
| `deepseek-ai/DeepSeek-V3.2` | decomposition | 17 | 13/17 | 13/17 | Apurinã ×4 over-segmented `…taka` |
| `zai-org/GLM-4.6` | decomposition | 17 | 16/17 | 16/17 | Apurinã ×1 `kaa kuta taka` |
| `google/gemma-4-31b-it:free` | default | 5 | 5/5 | 5/5 | partial (OpenRouter `:free`) — #6106 never recorded at this budget; a Featherless re-sweep is running |

Grading is over `data/ltb_model_outputs.json` as it stands after the parser fix
described below; `Items` is the number of the 17 queries actually recorded for
that arm, so rows are not directly comparable across arms.

Re-run note: this grid was measured twice. The first pass was lost when a
concurrent write to `data/ltb_model_outputs.json` was reverted, and the whole
grid was re-recorded into per-arm `--outputs` files. Two findings reproduced
identically (the Swahili result and the Turkish harmony errors); the Apurinã
`taka` effect moved between models between passes, which is why takeaway 2 is
worded as a rate rather than a per-model verdict.

Extraction fix (2026-10-10): `parse_morphemes` dropped any answer the tag parser
returned as a bare tag — an unterminated `<answers>\nkız lar` or a model that
wrapped the answer itself in one (`<mikhu n>`). Those are correct answers scored
as misses. Recovering the text from the answer block repaired 40 of the 155
recordings offline (from stored `raw`, no re-calls), which is what moved
GPT-OSS's `decomposition` arm to 17/17, DeepSeek to 13/17, and Qwen3-32B to
13/17. Anything that still reads as a miss was re-checked by hand.

### First sweep — 2026-09, via Arkor, `max_tokens=512` (archived: `data/ltb_model_outputs_truncated20261009.json`)

| Model | Score | Failure analysis |
|-------|-------|------------------|
| `google/gemma-4-31b-it` | 15 / 17 | 1 truncation (harness); 1 format-only (`tulimba`) |
| `google/gemini-3-8-flash` | 14 / 17 | 3 truncations (harness) — no modeling failures |

Key takeaways:

1. **The #6106 "breaks SOTA" claim is retracted.** It was an artifact of asking
   for the target-language word and then grading against the spaced
   decomposition. All five models recorded in the `decomposition` arm — including
   three open-weight models that had never been run on this set — write
   `tu li imba`. There is no difficulty evidence for #6106.
2. **Stating the format manufactures the opposite error.** Apurinã's aspect
   suffix `ka` sits inside the 'eat' verb `taka`, and when the prompt demands
   bare morphemes, models reach for the lexeme: 9 of the 24 Apurinã answers in
   the `decomposition` arm segment a standalone `taka` (DeepSeek-V3.2 4/5,
   Qwen3.8-27B 3/4, Qwen3-32B 1/5, GLM-4.6 1/5; GPT-OSS 0/5), answering
   `nhaa kuta taka` / `kaa kuta taka` / `a pita taka` where the gold is `… ka`.
   **None of the 17 Apurinã answers recorded in the arms that ask for the word
   contains a `taka` morpheme** — the same items are clean there (GPT-OSS 5/5 in
   both `default` and `no_hint`, Qwen3.8-27B 5/5 in `default` and 4/4 in
   `no_hint`, Gemma 3/3). So the exact-match gold is wrong in *both* directions:
   fused correct answers are punished for not segmenting, and demanding
   segmentation invites over-segmentation.
   The `taka` rate is unstable run-to-run (GPT-OSS showed it in the lost first
   pass and not in the re-run), so we report it as a prompt-induced error class,
   not as a per-model property.
3. **The hint is not load-bearing.** Withholding it costs nothing: GPT-OSS is
   17/17 with the format stated and 16/17 without the hint (its one no-hint miss
   is the unsegmented-but-correct `tulimba`, so 17/17 on the surface axis), and
   Qwen3.8-27B answers every item it reached (16/16). These items measure
   deduction from the evidence, not instruction-following on a scaffold — that
   closes the confound we flagged in September.
4. **The one item family with format-independent difficulty is Turkish vowel
   harmony, and it is narrower than "the model can't do harmony".** Qwen3-32B
   answers `kız lar` ('girls') correctly but `göz lar` ('eyes') and `gün lar`
   ('days') wrongly — it applies the back-harmony suffix after *rounded*
   front-vowel stems, which is exactly the sub-rule the unrounded stem does not
   exercise. It reproduced across both sweep passes, and every other model
   recorded (GPT-OSS, Qwen3.8-27B, DeepSeek-V3.2, GLM-4.6, Gemma) gets all three.
   A genuine modeling error, but one model and two items; present it as a lead.
   Caveat while we write this: Qwen3-32B is only recorded in the `decomposition`
   arm, so "format-independent" is currently an inference — the `default` and
   `no_hint` arms for that model are being recorded to test whether the error
   survives a prompt that asks for the word instead of the morphemes.
5. **Cheap lanes make a grid like this nearly free** — 3 arms × 6 models above
   ran on Groq's free tier plus well under a dollar of Featherless credit.

## Submitted proof-of-concept examples

On 2026-09-09 the two examples we then thought were strongest were submitted through the LTB contributor interface (https://last-translation-benchmark.vilda.net/contribute) and are pending review. **Both difficulty claims in that submission are wrong** and the docs here no longer repeat them:

| # | Source → Target | Input | Human translation | Corrected model evidence |
|---|-----------------|-------|-------------------|--------------------------|
| 6106 | English → Swahili | `we sang` | `tu li imba` | Retracted. Every model recorded in the `decomposition` arm produces `tu li imba` — GPT-OSS-120B, Qwen3.8-27b, Qwen3-32B, DeepSeek-V3.2 and GLM-4.6. The September failures were our prompt asking for the word while grading the segmentation. |
| 6107 | English → Apurinã | `he/she is going` | `a pita ka` | Solved by every model in the `default` / `no_hint` arms; the September "truncations" were a 512-token harness limit. In the `decomposition` arm, Qwen3-32B and DeepSeek-V3.2 answer `a pita taka` — the format-induced over-segmentation of takeaway 2, on the very item we submitted. |

The defensible contribution is the *verification design*, not item difficulty: see
takeaways 2 and 4 above and `docs/ltb-reviewer-note.md`.

## Files and structure

- `data/puzzles.json` — exported puzzle pool from `showcase/app/play/puzzle-data.ts`
- `data/ltb_export.json` — 17 LTB-formatted entries with `translations`, `verification_rules`, and `linguistics` tags
- `data/ltb_model_outputs.json` — 155 raw model recordings across 10 model×arm cells; entries carry `provider` and `prompt_variant`, and `raw` is kept so a parser fix can be re-applied offline instead of re-spending on calls
- `data/ltb_model_outputs_truncated20261009.json` — archived Sept sweep at `max_tokens=512`
- `scripts/export_to_ltb.py` — converts puzzle data to `data/ltb_export.json`
- `scripts/llm_providers.py` — provider registry (arkor → openrouter → groq → featherless → google) with retry/failover + health probe CLI
- `scripts/run_models_for_ltb.py` — runs a sweep (default 2048 tokens) in one `--prompt-variant` arm and records per-query outputs; `--outputs` writes a per-model file so arms can run in parallel without clobbering each other
- `scripts/score_ltb_outputs.py` — grades every recording on both axes and classifies each miss (`lane_failure` / `unsegmented_surface_form` / `truncation` / `parse artifact` / `evidence echo` / `wrong answer`); markdown table or `--json`, `--variant` to filter
- `docs/ltb-export-schema.md` — full format reference

## Attribution

All examples are credited to `https://ratiocine.trustfall.xyz/play?puzzle=<id>`.

## Open actions

1. Fill the coverage gaps that keep the grid honest (in flight on Featherless: Gemma 4 31B across all three arms, Qwen3-32B `default`/`no_hint`, DeepSeek-V3.2 `default`). Still open: Qwen3.8-27b lost 2 items per arm to Groq 429s, and GLM-4.6 is only recorded in one arm. Each run needs its own `--outputs` file, merged afterwards.
2. Featherless concurrency units are account-wide, not per-model: four model chains in parallel 429 every call after the first. Run one chain at a time.
3. ~~Run the Apurinã `ka`/`taka` over-segmentation against more models~~ — done: 9 of 24 decomposition-arm Apurinã answers over-segment across 4 models, 0 of 17 in the arms that ask for the word (takeaway 2). It is a prompt-format effect, not two models' quirk.
4. Get an independent linguist sign-off on the Apurinã segmentation (see reviewer note).
5. Decide the gold representation for the remaining items: the export now states the required output format and lists accepted surface spellings in `verification_rules`, which is the fix; whether to keep the spaced decomposition or the attested surface form as primary gold is a judgment call for the LTB team.
6. Scale from 17 to 25 problems (5 × 5) only if discriminative items can be authored — see the mining note in `AGENTS.md`.
