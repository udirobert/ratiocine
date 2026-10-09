# Research Progress Tracker

**Last Updated:** 2026-10-09

Statuses below are read from the code and the data files, not from this file's
previous state — the earlier version of this tracker described a plan, and
several of its boxes had quietly gone stale.

---

## Phase 1: Solver Trace Collection

### Implementation ✅ (code complete, production unverified)

- [x] Solver trace schema — `docs/solver-trace-schema.md`
- [x] `components/ConsentBanner.tsx` + settings toggle
- [x] `/privacy` page
- [x] `/api/log-trace` serverless route, `TRACE_SALT` double-hashing
- [x] `lib/analytics.ts` event union extended
- [x] Game instrumentation present in `app/play/`: `session_start`,
      `study_complete`, `tile_placed`, `tile_removed`, `context_reveal`,
      `query_reveal`, `hint_used`, `submit`, `first_submit`, `forfeit`,
      `ai_verdict`, `puzzle_solved`, `shared`, `share_click`, `play_start`
- [x] Share-copy A/B (`lib/share-ab.ts`): stable variant, `&sc=c|l` on
      challenge links, `share_variant` on `shared`, `share_click` on arrival
- [ ] Confirm the events actually fire on the production deployment
      (verified locally with `tsc --noEmit`; not verified in Vercel analytics)
- [ ] Privacy audit before treating collected traces as usable data
- [ ] Success metric (20+ opt-in sessions/day) — not yet measured

---

## Phase 2: LTB V2 Contribution

### Export tooling ✅

- [x] `data/puzzles.json` (10 puzzles) produced by `scripts/extract_puzzles.ts`
- [x] `scripts/export_to_ltb.py` — 17 entries in `data/ltb_export.json`
      (Apurinã 5, Swahili 3, Turkish 3, Quechua 3, Nahuatl 3)
- [x] Verification rules per entry, including the accepted-spellings rule
      added 2026-10-09 (joined + vowel-elided forms)
- [ ] Linguistic annotation review by someone who reads these languages
      (`linguistics` tags are currently rule-inferred, not signed off)

### Model evaluation 🟢 in progress

- [x] `scripts/llm_providers.py` — failover across arkor / openrouter / groq /
      featherless / google; Arkor's preview expired 2026-10 (404 on every model)
- [x] 2048-token sweeps, hinted arm: `openai/gpt-oss-120b` and
      `qwen/qwen3.8-27b` (Groq), `google/gemma-4-31b-it:free` (partial, 5 items)
- [x] `scripts/score_ltb_outputs.py` — dual grading (`EM_decomp`, `EM_surface`)
- [ ] `decomposition` and `no_hint` prompt arms across Qwen3-32B /
      DeepSeek-V3.2 / GLM-4.6 (Featherless) — running now
- [ ] Gemma 4 31B full 17-item re-sweep (OpenRouter `:free` throttles; needs
      credits, a Google AI Studio key, or Featherless `gemma-3-27b-it`, which is
      gated behind a HuggingFace org link on that account)
- [ ] Scale to the 25-item target: the other 5 puzzles hold 25 more queries,
      but Māori / Zulu / Finnish / Esperanto / Indonesian are weaker fits for
      LTB's low-resource mission than Apurinã or Quechua

### Difficulty claim — RETRACTED 2026-10-09

This replaces the "breaks SOTA models" framing that ran in these docs until
today. What happened:

1. The sweep prompt (`hf-pipeline/submission/prompts.py`) asks for *"the EXACT
   target-language form"* — it never asks for spaced morphemes, while our gold
   is a morpheme decomposition.
2. `split_joined_morphemes` re-split joined answers by walking the gold list,
   so it recovered Apurinã `apitaka` → `a pita ka` (exact concatenation) but
   failed Swahili `tulimba`, because `li + imba` elides a vowel in real
   orthography and never concatenates to `tuliimba`.
3. Result: 1 of 39 recorded answers was a *correct translation scored wrong*, 1
   was genuinely wrong (`tulisimba`), and the rest were uninformative.
   Qwen3-32B, DeepSeek-V3.2 and GLM-4.6 all answer `tu li imba` when the output
   format is stated.

So #6106 does not separate frontier models. What survives as a contribution is
a benchmark-design finding: **exact-match grading of a decomposed gold penalises
correct surface forms in any language with boundary phonology** — which matters
to LTB V2 specifically because it ships `verification_rules`.

- [ ] Decide whether to notify the LTB reviewers of the retracted framing
      (#6106/#6107 submitted 2026-09-09, still pending review)
- [ ] Re-export under the stated-format contract and resubmit
- [ ] Re-establish any difficulty claim on data from the explicit-format arm,
      or drop difficulty claims and lead with the verification-rule finding

---

## Phase 3: IOL-AI 2026 Technical Report

- [x] Draft `docs/iol-2026-technical-report.md` (8 submissions, hybrid CoT,
      error analysis narrative)
- [ ] 2 `TBD` placeholders remain (final rank, human jury results) — waiting on
      the private leaderboard
- [ ] `docs/error-analysis.csv` — 50 hand-labelled cases — **not created**
- [ ] Appendix C error examples, dependent on the CSV
- [ ] Publication decisions (see below) still open

---

## Phase 4: Ongoing

- [x] Puzzle bank expanded 5 → 10
- [ ] Solver-trace export to LTB format (monthly) — no traces exported yet
- [ ] Community puzzle contributions via PR — not opened up
- [ ] IOL organizer / LTB author outreach — not started
- [ ] Workshop paper (ACL/EMNLP 2027) — aspirational

---

## Open Decisions

| Decision | Options | Status | Notes |
|----------|---------|--------|-------|
| Gold representation in LTB entries | surface form vs decomposition | **Settled 2026-10-09** | Both, measured side by side; export states the format and accepts attested spellings |
| Tell LTB reviewers about the retracted claim | notify / wait | 🔴 Open | Items are in the review queue now |
| Technical report venue | arXiv vs GitHub-only | 🔵 Undecided | Recommendation: GitHub now, arXiv later |
| Publication timing | wait for private leaderboard vs publish | 🔵 Undecided | Recommendation: publish with TBDs |
| Solver trace dataset | fully open vs aggregate-only | 🔵 Undecided | Recommendation: aggregate-only |
| Formal venue submission | ACL/EMNLP vs workshop vs none | 🔵 Undecided | Workshop 2027 if there is interest |

---

## Next session start here

1. Read the explicit-format arm results (`python3 scripts/score_ltb_outputs.py`)
   and decide whether any item survives as discriminative.
2. If none do, author deeper queries — multi-morpheme chaining and evidence-only
   exceptions — rather than adding more 1-step compositions, which the 2048-token
   sweeps show frontier models solve.
3. Verify Phase-1 events on the production deployment, then start counting
   opt-in sessions.

---

## Resources

**Planning docs (exist):** `docs/solver-trace-schema.md`,
`docs/ltb-export-schema.md`, `docs/iol-2026-technical-report.md`,
`docs/research-roadmap.md`, `docs/phase1-implementation.md`,
`docs/ltb_submission_summary.md`, `docs/ltb-reviewer-note.md`

**Removed references:** `RESEARCH_NEXT_STEPS.md` and
`PHASE1_IMPLEMENTATION_STATUS.md` were cited here previously and do not exist in
the repo.

**External links:**

- Last Translation Benchmark dataset: <https://huggingface.co/datasets/zouhar/last-translation-benchmark>
- LTB submission site: <https://last-translation-benchmark.vilda.net>
- LTB paper: <https://arxiv.org/abs/2609.04173>
- Linguini benchmark: <https://huggingface.co/datasets/linguini/linguini>
- IOL official site: <https://ioling.org>

**Contact:**

- GitHub: <https://github.com/udirobert/ratiocine>
- Project site: <https://ratiocine.trustfall.xyz>
- Daily game: <https://ratiocine.trustfall.xyz/play>
