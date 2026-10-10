# Note for the LTB V2 team — Ratiocine contribution

(Internal draft before sending. References #6106 and #6107, submitted 2026-09-09 via https://last-translation-benchmark.vilda.net/contribute.)

## Who we are

Ratiocine is an IOL-AI competition team and linguistics research platform (github.com/udirobert/ratiocine). Our examples come from a public daily puzzle game where human solvers and AI models attempt the same problems under identical exact-match grading.

## What we are contributing

17 IOL-style few-shot morphological reasoning examples in five under-represented languages (Apurinã, Swahili, Turkish, Quechua, Nahuatl), formatted per `docs/ltb-export-schema.md`. Each item specifies an English source, a tile bank of morphemes, self-contained bilingual evidence in `source_instructions`, the required output format stated in the item itself, and a morpheme-sequence ground truth whose accepted surface spellings are enumerated in `verification_rules` — verification is deterministic and reproducible without external resources.

We believe these target a gap most LTB entries do not cover: benchmark items score translation *output* quality, while ours require *exact morphological composition* against an explicit tile bank, verifiable without a judge. Our own ablation (below) is part of what we want to contribute, because it shows how easily such an item measures the harness instead of the model.

## Evidence so far (honest limits)

We ran an ablation across three prompt arms (stock IOL prompt; the same prompt
with the output format stated explicitly as space-separated morphemes; and the
stock prompt with the hint block withheld) against
GPT-OSS-120B, Qwen3.8-27B, Qwen3-32B, DeepSeek-V3.2, GLM-4.6 and Gemma 4 31B, at
2048 output tokens, and we grade every recording on two axes: whether the answer
equals the tile decomposition, and whether it equals an attested surface form of
it.

- **A claim we previously made in the submission interface is wrong and we are
  retracting it.** We reported that Swahili "we sang" → `tu li imba` defeated
  three strong models 3-of-3. It does not. Our prompt asked for the
  target-language form while our gold was the spaced decomposition, so a model
  writing the correct fused form `tulimba` was scored as a reasoning failure.
  With the required output format stated, every model we have recorded —
  including three open-weight models that had never been run on this set —
  produces `tu li imba`. Item #6106 has no difficulty evidence and we are not
  asking you to treat it as one.
- **What does survive is about item design, not model weakness.** Exact-match
  grading of a decomposed gold penalises correct surface forms whenever the
  morpheme boundary carries phonology (Bantu vowel elision: `tu`+`li`+`imba`
  surfaces as `tulimba`, never `tuliimba`). And the failure runs the other way
  too: demanding spaced morphemes induced over-segmentation on our Apurinã
  items, where the aspect suffix `ka` is a substring of the 'eat' verb `taka`.
  In the re-run of the whole grid, 9 of the 24 Apurinã answers recorded in that
  arm segment a standalone `taka` morpheme (across 4 of its 5 models) and answer
  `nhaa kuta taka` / `a pita taka` for a gold of `… ka`, while not one of the 17
  Apurinã answers recorded in the arms that ask for the word contains a `taka`
  morpheme. A
  constrained-composition item only measures composition if the accepted output
  format and the graded gold are the same representation.
- **Practical suggestion:** have `verification_rules` enumerate the accepted
  spellings (we now generate both the joined and elided forms into our exports),
  or grade against a surface form and treat segmentation as a separate,
  format-level check.
- The hint block in `source_instructions` is not load-bearing: with it withheld,
  GPT-OSS-120B still scores 16/17 and Qwen3.8-27B answered every item it reached.
  These items measure deduction from the evidence rather than
  instruction-following on a scaffold.
- The only format-independent difficulty we can point at is Turkish harmony, and
  it is narrow: Qwen3-32B answers `kız lar` ('girls') correctly but `göz lar` and
  `gün lar` wrongly — the back-harmony suffix after *rounded* front-vowel stems —
  reproduced across two independent passes, while every other model we recorded
  gets all three. Two items against one model, so we offer it as a lead rather
  than a finding.
- Ground-truth segmentations are authored by our team; we are arranging
  independent linguist verification of the Apurinã set and will share it on
  request.
- Coverage caveat: the grid is not complete. Gemma 4 31B is recorded on 5 of 17
  items; Groq's free tier dropped a few items to 429s; and some open-weight runs
  on our Featherless lane returned blank or degenerate completions, which we
  exclude as lane failures rather than model answers.

## Ask

1. Feedback on format and verification rules for #6106/#6107 so we can align the remaining 15 before scaling up.
2. If the contribution is accepted, we would like the Ratiocine team listed on the LTB V2 author list.
3. We can scale from 17 to 25 items, but not by padding: measured on our own grid, the remaining queries in our puzzle bank are single-rule compositions that every model we ran already solves. Tell us whether LTB V2 wants (a) more items of that kind for coverage, or (b) fewer, harder items — we can author the latter if you confirm they should chain sub-rules (harmony with a decoy feature, boundary phonology that a spaced gold punishes), since that needs new evidence rows reviewed by a linguist rather than new prompts.
