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
| `Qwen/Qwen3-32B` | decomposition | 17 | 13/17 | 13/17 | 1 Featherless lane failure + 1 `…taka` + the 2 Turkish slips (`göz lar`, `gün lar` — the second does not survive the other arm, see takeaway 4) → 13/16 answered |
| `Qwen/Qwen3-32B` | default | 17 | 9/17 | 10/17 | 5 Featherless lane failures + 1 evidence-echo truncation — of the 11 answers the lane actually delivered, **8 are correct**, and the two misses are Turkish `göller` ('lakes', the wrong word) and Swahili `tulimba` (right word, no segmentation). Not a reasoning-weak arm; a broken lane. |
| `deepseek-ai/DeepSeek-V3.2` | decomposition | 17 | 13/17 | 13/17 | Apurinã ×4 over-segmented `…taka` |
| `deepseek-ai/DeepSeek-V3.2` | default | 2 | 2/2 | 2/2 | Featherless 503'd this model mid-arm; only 2 of 17 items recorded, both correct (`nhaakutaka`, `ãnykataka`) |
| `zai-org/GLM-4.6` | decomposition | 17 | 16/17 | 16/17 | Apurinã ×1 `kaa kuta taka` |
| `google/gemma-4-31b-it` | decomposition | 17 | 13/17 | 13/17 | Apurinã ×4 over-segmented `…taka` |
| `google/gemma-4-31b-it` | default | 17 | 16/17 | **17/17** | #6106 → `tulimba`: correct translation, scored wrong on format |
| `google/gemma-4-31b-it` | no_hint | 17 | 16/17 | **17/17** | same single `tulimba` miss |
| `google/gemma-4-31b-it:free` | default | 5 | 5/5 | 5/5 | earlier partial (OpenRouter `:free`); superseded by the Featherless rows above |

Grading is over `data/ltb_model_outputs.json` as it stands after the parser fix
described below — **225 recordings across 15 model×arm cells** — and `Items` is
the number of the 17 queries actually recorded for that arm, so rows are not
directly comparable across arms. Where an arm is short, the reason is a serving
lane (Featherless 503 / Groq 429), not a dropped item.

Re-run note: this grid was measured twice. The first pass was lost when a
concurrent write to `data/ltb_model_outputs.json` was reverted, and the whole
grid was re-recorded into per-arm `--outputs` files. Two findings reproduced
identically (the Swahili result and the Turkish harmony errors); the Apurinã
`taka` effect moved between models between passes, which is why takeaway 2 is
worded as a rate rather than a per-model verdict.

Extraction fix (2026-10-10): `parse_morphemes` dropped any answer the tag parser
returned as a bare tag — an unterminated `<answers>\nkız lar` or a model that
wrapped the answer itself in one (`<mikhu n>`). Those are correct answers scored
as misses. Recovering the text from the answer block repaired 40 of the then-155
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
   bare morphemes, models reach for the lexeme: 13 of the 29 Apurinã answers in
   the `decomposition` arm segment a standalone `taka` (DeepSeek-V3.2 4/5,
   Gemma 4 31B 4/5, Qwen3.8-27B 3/4, Qwen3-32B 1/5, GLM-4.6 1/5; GPT-OSS 0/5),
   answering `nhaa kuta taka` / `a pita taka` where the gold is `… ka`.
   **None of the 39 Apurinã answers recorded in the arms that ask for the word
   (five models, nine cells) contains a `taka` morpheme.** So the
   exact-match gold is wrong in *both* directions: fused correct answers are
   punished for not segmenting, and demanding segmentation invites
   over-segmentation.
   The `taka` rate is unstable run-to-run (GPT-OSS showed it in the lost first
   pass and not in the re-run), so we report it as a prompt-induced error class,
   not as a per-model property.
   All 13 were checked against the stored `raw`: the `taka` is the model's own
   token inside its `<answers>` block, not an artifact of our segmenter. Gemma 4
   31B's trace even shows the self-check failing — "Check: a + pita + taka =
   apitaka" — when `a`+`pita`+`taka` concatenates to `apitataka`, not the gold
   word `apitaka`. Under a bare-morpheme instruction the model pads the sequence
   with a lexeme tile and its own verification step does not catch it.
3. **The hint is not load-bearing.** Withholding it costs nothing: GPT-OSS is
   17/17 with the format stated and 16/17 without the hint (its one no-hint miss
   is the unsegmented-but-correct `tulimba`, so 17/17 on the surface axis), and
   Qwen3.8-27B answers every item it reached (16/16). These items measure
   deduction from the evidence, not instruction-following on a scaffold — that
   closes the confound we flagged in September.
4. **One item has format-independent difficulty, and it is a single model on a
   single item.** Turkish `göz ler` ('eyes') is missed by Qwen3-32B in **both**
   arms, and the two errors are not the same error: with the format stated it
   writes `göz lar`, and with the word asked for it writes `göller`, which is
   'lakes' — a different lexeme. Every other cell we recorded gets it: GPT-OSS,
   Qwen3.8-27B and Gemma 4 31B in all three arms, DeepSeek-V3.2 and GLM-4.6 in the
   `decomposition` arm (DeepSeek's word-asking arm only reached 2 of 17 items).
   Why the item is hard is worth stating precisely, because the evidence explains
   it. The puzzle teaches two shapes — unrounded *front* stems (`ev`, `el` →
   `-ler`) and unrounded *back* stems (`at`, `kitap` → `-lar`) — and never shows a
   **rounded front** stem taking a suffix. `göz` and `gün` are exactly that
   untaught combination, so the item asks a model to apply a rule the evidence
   implies but does not demonstrate. A model that imports the *four-way* rule,
   where rounding does decide the vowel (`-ı` vs `-u`), slips to `göz lar`.
   **The companion claim in the earlier draft of this document was wrong and is
   retracted here.** We grouped `gün ler` with `göz ler` as one harmony failure and
   called the pair "format-independent". It is not: Qwen3-32B answers `günler`
   correctly in the `default` arm and only `gün lar` in the `decomposition` arm, so
   it belongs with the Apurinã `taka` effect — an error the spaced-format
   instruction induces, not a gap in the model's Turkish. Same item, same model,
   and the only variable is whether the prompt names the output representation.
   (An earlier draft also described `kız` as an "unrounded front" decoy; `ı` is
   back-unrounded, so `kız lar` is the ordinary case and not part of the trap.)
   Caveat on the one surviving claim: Qwen3-32B's `default` arm is a weak lane — 5
   of its 17 recordings are Featherless failures that returned nothing, and one
   returned the reasoning preamble — so it answered 11 items. The `göz` failure is
   real in both arms, but the "every other model gets it" side rests mainly on the
   `decomposition` arm.
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

## Mining decision (2026-10-10)

Before scaling to 25 items we asked what the recorded grid actually separates.
Per item, across **all 15 model×arm cells** (so a row mixes the arm that demands
morphemes with the arms that ask for the word — which is the point: the columns
separate where the miss came from):

| Language | Gold | n | correct | `taka` artifact | surface, not segmented | lane / truncation | real miss |
|----------|------|---|---------|-----------------|------------------------|-------------------|-----------|
| Apurinã | `nhaa kuta ka` | 15 | 12 | 2 | 0 | 1 | 0 |
| Apurinã | `kaa kuta ka` | 13 | 8 | 4 | 0 | 1 | 0 |
| Apurinã | `ã nykata ka` | 14 | 11 | 2 | 0 | 1 | 0 |
| Apurinã | `kaa nykata ka` | 13 | 10 | 2 | 0 | 1 | 0 |
| Apurinã | `a pita ka` (#6107) | 13 | 10 | 3 | 0 | 0 | 0 |
| Swahili | `ni ta penda` | 14 | 14 | 0 | 0 | 0 | 0 |
| Swahili | `wa na soma` | 13 | 13 | 0 | 0 | 0 | 0 |
| Swahili | `tu li imba` (#6106) | 12 | 6 | 0 | **5** | 0 | **1** |
| Turkish | `göz ler` | 13 | 11 | 0 | 0 | 0 | **2** |
| Turkish | `kız lar` | 13 | 13 | 0 | 0 | 0 | 0 |
| Turkish | `gün ler` | 14 | 13 | 0 | 0 | 0 | **1** |
| Quechua | `puri ni` | 13 | 13 | 0 | 0 | 0 | 0 |
| Quechua | `riku nchik` | 13 | 13 | 0 | 0 | 0 | 0 |
| Quechua | `mikhu n` | 13 | 12 | 0 | 0 | 1 | 0 |
| Nahuatl | `ni cuica` | 13 | 12 | 0 | 0 | 1 | 0 |
| Nahuatl | `choca h` | 13 | 12 | 0 | 0 | 1 | 0 |
| Nahuatl | `ni cuica h` | 13 | 13 | 0 | 0 | 0 | 0 |

`n` is the number of cells that recorded that item (13–15; the shortfalls are the
Groq 429s that cost Qwen3.8-27B two items, a Featherless 503 that stopped
DeepSeek's `default` arm at 2 of 17, and Qwen3.8-27B's partial `no_hint` sweep).

Read the columns, not the totals. Twelve of the seventeen items are solved by
every cell that reached them. Of the five that are not, four are entirely a
format effect: the `taka` column is the spaced-format instruction inducing an
extra morpheme (13 of 29 decomposition-arm Apurinã answers, 0 of 39 word-asking
ones), and the Swahili row's five `tulimba` entries are correct translations
scored against a decomposed gold. The only genuinely wrong formations on the
whole grid are three, and two of them are one model on one item:

- Turkish `göz ler` — Qwen3-32B, in **both** arms, with two different errors
  (`göz lar` = harmony slip; `göller` = 'lakes', wrong lexeme).
- Turkish `gün ler` — Qwen3-32B in the `decomposition` arm only (`gün lar`); it
  writes `günler` correctly when asked for the word, so this one belongs in the
  format column, not the difficulty column.
- Swahili `tu li imba` — GPT-OSS in the `default` arm wrote `tulisimba`, an
  insertion of `s` that no Swahili paradigm produces. One model, one arm.

So no item separates two or more *models* for a reasoning reason. Leading with
`göz ler` would be honest but thin — one model, and that model's `default` arm is
a broken lane (5 of its 17 recordings returned nothing at all). At 2048 tokens,
with the output format stated, the exported set does not discriminate the models
we can run.

So the scale-up is not a matter of exporting the remaining 8 queries from the
existing puzzles — a single-rule query is either trivial or an artifact trap.
Discriminative items need a **sub-rule the evidence only implies**, and an
accepted-answer spelling that cannot be recovered by concatenation. Two shapes
worth authoring:

- **Harmony with a decoy feature.** Turkish is the worked case, and the phonology
  is more interesting than the earlier draft of this section said. The evidence
  teaches two shapes — unrounded *front* stems (`ev`, `el` → `-ler`) and unrounded
  *back* stems (`at`, `kitap` → `-lar`) — and never shows a **rounded front** stem
  taking a suffix. So `göz` and `gün` are exactly the underdetermined combination.
  A model that imports the *four-way* rule (where rounding does decide the vowel:
  `-ı` vs `-u`) into the two-way plural slips to `göz lar`. That is the error we
  recorded, and it is the shape worth authoring more of: an item whose evidence
  implies a rule but does not teach the queried combination.
  (`kız` is a back-unrounded stem — `kız lar` is the ordinary case, not a decoy;
  the previous draft of this bullet had it the other way round. The Finnish puzzle
  is the mirror-image decoy: `koulu` → `-ssa` despite the `u`, `kylä` → `-ssä`.)
- **Morpheme-boundary collisions** — `ka` inside `taka` is one; Quechua `mikhu n`
  (a final-vowel stem plus a consonant-initial suffix) is another. These are
  worth authoring *as surface-form items*, because the collision is exactly what
  a spaced gold punishes.

Constraint on all of it: the tile bank bounds what is answerable, so a harder item
means new evidence rows in `showcase/app/play/puzzle-data.ts` (game content that has
to be linguistically correct), not a new prompt. That is authoring work with a
linguist, not sweep work — hence open action 4 (sign-off) gates open action 6.

The other 5 puzzles (Esperanto, Indonesian, Finnish, Māori) are 25 more queries and
would fill the grid cheaply, but they are well-resourced languages and a weaker fit
for LTB's low-resource mission, so they stay out of the export unless an item from
them is genuinely discriminative.

The cheaper honest move for now is to reframe the contribution: we ship 17 items
whose format contract is explicit and whose accepted spellings are enumerated, plus
the measurement that single-rule composition items do not discriminate current
models.

## Files and structure

- `data/puzzles.json` — exported puzzle pool from `showcase/app/play/puzzle-data.ts`
- `data/ltb_export.json` — 17 LTB-formatted entries with `translations`, `verification_rules`, and `linguistics` tags
- `data/ltb_model_outputs.json` — 225 raw model recordings across 15 model×arm cells (5 models in all three arms, Qwen3-32B and DeepSeek-V3.2 in two, GLM-4.6 in one); entries carry `provider` and `prompt_variant`, and `raw` is kept so a parser fix can be re-applied offline instead of re-spending on calls
- `data/ltb_model_outputs_truncated20261009.json` — archived Sept sweep at `max_tokens=512`
- `scripts/export_to_ltb.py` — converts puzzle data to `data/ltb_export.json`
- `scripts/llm_providers.py` — provider registry (arkor → openrouter → groq → featherless → google) with retry/failover + health probe CLI
- `scripts/run_models_for_ltb.py` — runs a sweep (default 2048 tokens) in one `--prompt-variant` arm and records per-query outputs; `--outputs` writes a per-model file so arms can run in parallel without clobbering each other
- `scripts/score_ltb_outputs.py` — grades every recording on both axes and classifies each miss (`lane_failure` / `unsegmented_surface_form` / `truncation` / `parse artifact` / `evidence echo` / `wrong answer`); markdown table or `--json`, `--variant` to filter
- `docs/ltb-export-schema.md` — full format reference

## Attribution

All examples are credited to `https://ratiocine.trustfall.xyz/play?puzzle=<id>`.

## Open actions

1. Fill the coverage gaps that keep the grid honest. Closed since the last commit: Gemma 4 31B in all three arms, and Qwen3-32B `default`. Still open: Qwen3-32B `no_hint`, DeepSeek-V3.2 `default` (Featherless 503'd it at 2 of 17), GLM-4.6 outside the `decomposition` arm, and the two Qwen3.8-27b items it lost per arm to Groq 429s. Qwen3-32B `default` is also the one cell where the *lane* is the problem — 5 blank/`!!!!` completions — so a re-run there is worth more than a new model. Each run needs its own `--outputs` file, merged afterwards.
2. Featherless concurrency units are account-wide, not per-model: four model chains in parallel 429 every call after the first. Run one chain at a time.
3. ~~Run the Apurinã `ka`/`taka` over-segmentation against more models~~ — done: 13 of 29 decomposition-arm Apurinã answers over-segment across 5 models, 0 of 39 in the arms that ask for the word (takeaway 2). It is a prompt-format effect, not two models' quirk.
4. **The blocker on everything else:** get an independent speaker/linguist to sign off the ground-truth segmentations for Apurinã, Quechua and Nahuatl (and the rule-inferred `linguistics` tags). We authored them; without a second reader they are our analysis, not verified data. It gates action 6, because a harder item needs new evidence rows in `puzzle-data.ts` — game content somebody has to certify. Not started: no reviewer contacted.
5. Decide the gold representation for the remaining items: the export now states the required output format and lists accepted surface spellings in `verification_rules`, which is the fix; whether to keep the spaced decomposition or the attested surface form as primary gold is a judgment call for the LTB team.
6. Scale from 17 to 25 problems (5 × 5) only if discriminative items can be authored — see the mining note in `AGENTS.md`.
7. Widen the model set. "No item separates two of the models we can run" is measured over six
   models, so it is bounded by reach, not by the items. Featherless gates `gemma-3-27b-it` and
   Llama-3.3-70B behind a HuggingFace account link on the same funded key (`gemma-4-31B-it` is
   not gated), and `qwen/qwen3.8-27b` is Groq-only. Linking HF is the cheapest way to test the
   negative result at larger n.
8. Send (or deliberately not send) `docs/ltb-reviewer-note.md`. It is drafted and matches the
   data; #6106/#6107 sit in the review queue carrying the retracted framing until we do.
