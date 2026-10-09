# Note for the LTB V2 team — Ratiocine contribution

(Internal draft before sending. References #6106 and #6107, submitted 2026-09-09 via https://last-translation-benchmark.vilda.net/contribute.)

## Who we are

Ratiocine is an IOL-AI competition team and linguistics research platform (github.com/udirobert/ratiocine). Our examples come from a public daily puzzle game where human solvers and AI models attempt the same problems under identical exact-match grading.

## What we are contributing

17 IOL-style few-shot morphological reasoning examples in five under-represented languages (Apurinã, Swahili, Turkish, Quechua, Nahuatl), formatted per `docs/ltb-export-schema.md`. Each item specifies an English source, a tile bank of morphemes, self-contained bilingual evidence in `source_instructions`, and an exact morpheme-sequence ground truth — verification is deterministic and reproducible without external resources.

We believe these target a gap most LTB entries do not cover: benchmark items score translation *output* quality, while ours require *exact morphological composition* — models frequently produce a fluent, orthographically natural word that is wrong under the segmentation the evidence demands.

## Evidence so far (honest limits)

- Swahili "we sang" → `tu li imba`: **fails every strong model we have tested at adequate token budget — 3 of 3.** OpenAI GPT-OSS-120B outputs `tulisimba`, Qwen3.8-27B outputs `tulimba`, Google Gemma 4 31B outputs `tulimba`. All produce the orthographically natural word instead of the required morpheme segmentation. GPT-OSS-120B and Qwen3.8-27B each scored 16/17 on our full set; this was their only miss in both cases.
- Apurinã items: the September runs' apparent failures were our harness truncating long reasoning traces at 512 tokens; re-run at 2048 tokens, current models solve them. We will reposition or replace weaker items (including #6107) before review concludes rather than leave inflated difficulty claims standing.
- Ground-truth segmentations are authored by our team; we are arranging independent linguist verification of the Apurinã set and will share it on request.
- The items include a structural hint in `source_instructions`. They measure constrained composition under guidance, not unscaffolded discovery — a no-hint variant is planned.

## Ask

1. Feedback on format and verification rules for #6106/#6107 so we can align the remaining 15 before scaling up.
2. If the contribution is accepted, we would like the Ratiocine team listed on the LTB V2 author list.
3. We can scale to 25 items (5 languages × 5 queries) and add stronger model baselines on your preferred cadence.
