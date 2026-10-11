# Research Progress Tracker

**Last Updated:** 2026-10-10

Statuses below are read from the code and the data files, not from this file's
previous state — the earlier version of this tracker described a plan, and
several of its boxes had quietly gone stale.

---

## Phase 1: Solver Trace Collection

### Implementation ✅ (wired end-to-end 2026-10-11, verified locally; production pending Blob env)

- [x] Solver trace schema — `docs/solver-trace-schema.md`
- [x] `components/ConsentBanner.tsx` — appears 10s after first solve
      (listens for `ratiocine:progress-saved`), dispatches `ratiocine:consent`
      on accept
- [x] `/privacy` page
- [x] `/api/log-trace` → SHA-256-hashed session id (`TRACE_SALT`, fixed-salt
      fallback) → private Vercel Blob `traces/<date>/`. **`BLOB_READ_WRITE_TOKEN`
      required in Vercel — without it events are accepted but stored nowhere**
      (dev falls back to `/tmp/solver-traces.jsonl`)
- [x] `lib/analytics.ts` — `trackSolverEvent` covers `session_start`,
      `study_complete`, `tile_placed`, `tile_removed`, `submit`, `forfeit`,
      `ai_verdict`, `share`; all wired at real interaction points in
      `puzzle-view.tsx`, consent-gated. `evidence_interaction` captures
      per-row dwell, trace taps and `shared_with` row linkages;
      `session_start` anchors on `ratiocine:consent` for mid-session opt-ins
- [x] Funnel events via `track()`: `play_start` (with `via` attribution:
      challenge/deep_link/direct/landing), `study_complete`, `first_submit`,
      `hint_used`, `query_reveal`, `context_reveal`, `evidence_open`,
      `puzzle_solved`, `shared`, `share_click`, `ai_verdict`
- [x] Share-copy A/B (`lib/share-ab.ts`): stable variant, `&sc=c|l` on
      challenge links, `share_variant` on `shared`, `share_click` on arrival
- [x] Verified end-to-end locally (2026-10-11): consented session wrote
      `session_start`/`study_complete`/`tile_placed`/`submit` to
      `/tmp/solver-traces.jsonl` with real interaction data
- [ ] Confirm events land in Blob on production (needs `BLOB_READ_WRITE_TOKEN`)
- [ ] Privacy audit before treating collected traces as usable data
- [ ] Success metric (20+ opt-in sessions/day) — not yet measured

---

## Phase 2: LTB V2 Contribution

### Export tooling ✅

- [x] `data/puzzles.json` (10 puzzles) produced by `scripts/extract_puzzles.ts`
- [x] `scripts/export_to_ltb.py` — 17 entries in `data/ltb_export.json`
      (Apurinã 5, Swahili 3, Turkish 3, Quechua 3, Nahuatl 3)
- [x] Regenerate `data/ltb_export.json` — done 2026-10-10. The file a reviewer
      reads now states the required output format, enumerates accepted joined and
      elided spellings, and marks a correct `tulimba` as verified on the meaning
      rules and unverified on segmentation only (124 translations from 225
      recordings, deduped per model with the arm each answer came from)
- [ ] 🔴 **BLOCKER** — Independent sign-off by someone who reads Apurinã, Quechua
      and Nahuatl, covering the ground-truth segmentations *and* the
      rule-inferred `linguistics` tags (neither has been reviewed by a second
      person). This gates authoring new items: the tile bank bounds what is
      answerable, so a harder item means new evidence rows in
      `showcase/app/play/puzzle-data.ts`, which is game content someone has to
      certify as correct — not a prompt change. Nothing can be mined until it is
      unblocked, and we are the ones writing these analyses, so self-review is
      not evidence.

### Model evaluation 🟢 in progress

- [x] `scripts/llm_providers.py` — failover across arkor / openrouter / groq /
      featherless / google; Arkor's preview expired 2026-10 (404 on every model)
- [x] 2048-token sweeps, hinted arm: `openai/gpt-oss-120b` and
      `qwen/qwen3.8-27b` (Groq)
- [x] Gemma 4 31B recorded in all three arms from the Featherless lane (17 items
      each), superseding the 5-item OpenRouter `:free` partial; Qwen3-32B in two
      arms. Grid is now 15 model×arm cells / 225 recordings.
- [ ] Widen the model set — the negative result ("no item separates two of the
      models we can run") is only measured over 6 models, so it is bounded by
      which models we could reach. Featherless gates `gemma-3-27b-it` and
      Llama-3.3-70B behind a HuggingFace account link on the same funded key
      (`gemma-4-31B-it` is not gated), and `qwen/qwen3.8-27b` is Groq-only (404 on
      Featherless). Linking HF is a few minutes of account work for the user and
      is the cheapest way to test whether the finding holds at a larger n.
- [x] `scripts/score_ltb_outputs.py` — dual grading (`EM_decomp`, `EM_surface`)
- [x] `decomposition` arm across Qwen3-32B / DeepSeek-V3.2 / GLM-4.6 (Featherless)
      — all three answer `tu li imba`; the only Apurinã misses are the `taka`
      format artifact
- [ ] Remaining `default` / `no_hint` cells: Qwen3-32B `no_hint`, GLM-4.6 outside
      the decomposition arm, DeepSeek-V3.2 `default` (Featherless 503'd it at 2 of
      17), the 2 items per arm Qwen3.8-27B lost to Groq 429s, and the 5 blank
      Qwen3-32B `default` completions — that last one is the only re-run that could
      change a conclusion rather than add coverage. Featherless concurrency units
      are account-wide: one chain at a time or every call 429s.
- [x] Gemma 4 31B full 17-item re-sweep unblocked: Featherless serves
      `google/gemma-4-31B-it` without the HuggingFace gate that blocks
      `gemma-3-27b-it` on that account (OpenRouter `:free` is upstream-throttled
      on nearly every call)
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

**Measured 2026-10-10** (15 model×arm cells, 225 recordings,
`data/ltb_model_outputs.json`, scored on both axes by `scripts/score_ltb_outputs.py`):

- Every model recorded in the `decomposition` arm answers `tu li imba` —
  GPT-OSS-120B, Qwen3.8-27B, Qwen3-32B, DeepSeek-V3.2, GLM-4.6. GPT-OSS is
  17/17 in that arm.
- The hint block is not load-bearing: with it withheld GPT-OSS is 16/17 on the
  decomposition axis and 17/17 on the surface axis (its one miss is the
  correctly-fused `tulimba`), and Qwen3.8-27B answers everything it reached
  (16/16).
- Stating the format induces a *different* error: 13 of the 29 Apurinã answers in
  the decomposition arm segment a standalone `taka` (the 'eat' tile) for the
  aspect suffix `ka`, across 5 of its 6 models — and 0 of the 39 Apurinã answers
  recorded in the arms that ask for the word do.
- One item has format-independent difficulty: Turkish `göz ler` ('eyes'), missed
  by Qwen3-32B in **both** arms and with two different errors — `göz lar`
  (back-harmony suffix after a rounded front stem) when the format is stated,
  `göller` ('lakes', a different lexeme) when the word is asked for. Thin
  evidence: that model's word-asking lane returned nothing for 5 of its 17 items.
- **Correction to this file's earlier draft**, which listed `gün ler` beside
  `göz ler` as the same harmony failure and called the pair format-independent:
  Qwen3-32B writes `günler` correctly in the `default` arm and only `gün lar` in
  the `decomposition` arm, so it belongs in the format-induced column with
  Apurinã `taka`. Same item, same model, and the only variable is whether the
  prompt names the output representation — which is the finding, not the harmony.
- The other genuine miss on the grid is one cell: GPT-OSS-120B `default` wrote
  `tulisimba` for Swahili `tu li imba`, an inserted `s` no Swahili paradigm
  produces.
- `parse_morphemes` was dropping any answer the tag parser returned as a bare
  tag (an unterminated `<answers>` block, or `<mikhu n>`), scoring correct
  answers as misses. Fixed, then 40 recordings were re-derived offline from the
  stored `raw` — no re-calls. That repair is what moved GPT-OSS's decomposition
  arm to 17/17, DeepSeek-V3.2 to 13/17 and Qwen3-32B to 13/17.
- Blank / degenerate Featherless completions are classified `lane_failure` and
  must not be read as model errors.

- [ ] Decide whether to notify the LTB reviewers of the retracted framing
      (#6106/#6107 submitted 2026-09-09, still pending review)
- [x] Re-export under the stated-format contract — `data/ltb_export.json`
      regenerated 2026-10-10: every entry now states the required output format in
      `source_instructions`, carries an accepted-spellings rule (joined + elided),
      and lists model translations with the prompt arm they came from. Lane
      failures are no longer exported as translations, and repeated answers are
      deduped across arms. Remaining: resubmit, gated on the reviewer-note decision
- [x] Re-establish any difficulty claim on data from the explicit-format arm,
      or drop difficulty claims and lead with the verification-rule finding —
      **no difficulty claim survives except Turkish `göz ler`, and it rests on one
      model (n=1, with a broken lane); lead with the verification-rule finding**
- [ ] Close the coverage gaps. Done since the last update: gemma in all three arms
      (17 items each), Qwen3-32B `default`. Still open: Qwen3-32B `no_hint`;
      DeepSeek-V3.2 `default`, which Featherless 503'd at 2 of 17; GLM-4.6 outside
      the decomposition arm; 2 items per arm lost to Groq 429 on Qwen3.8-27B; and
      the 5 blank Qwen3-32B `default` completions, which are the one cell where a
      re-run would change the conclusion rather than the coverage. Featherless
      concurrency units are account-wide, so chains must run one at a time.

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
| Tell LTB reviewers about the retracted claim | notify / wait | 🔴 Open — user's call | `docs/ltb-reviewer-note.md` is drafted and current (retraction, the two-directional format finding, the `göz ler` correction, coverage caveats); nothing has been sent |
| Technical report venue | arXiv vs GitHub-only | 🔵 Undecided | Recommendation: GitHub now, arXiv later |
| Publication timing | wait for private leaderboard vs publish | 🔵 Undecided | Recommendation: publish with TBDs |
| Solver trace dataset | fully open vs aggregate-only | 🔵 Undecided | Recommendation: aggregate-only |
| Formal venue submission | ACL/EMNLP vs workshop vs none | 🔵 Undecided | Workshop 2027 if there is interest |

---

## Next session start here

1. ~~Read the explicit-format arm results and decide whether any item survives as
   discriminative~~ — done 2026-10-10: across 15 cells the only genuinely wrong
   formations are Turkish `göz ler` (one model, both arms, two different errors),
   Turkish `gün ler` (one model, decomposition arm only — so format-induced, not
   a harmony gap), and Swahili `tulisimba` (one model, one arm). No item separates
   two models. See `docs/ltb_submission_summary.md` → Mining decision.
2. ~~Merge the in-flight gap arms, re-score, regenerate the export, delete the
   scratch files~~ — done 2026-10-10: 225 recordings in `data/ltb_model_outputs.json`,
   `data/ltb_export.json` regenerated under the stated-format contract.
3. Stop item mining and put the effort into the linguist sign-off — harder items
   need new evidence rows in `puzzle-data.ts`, which is authoring work, not sweep
   work. The shape to author is an item whose evidence implies a rule without
   teaching the queried combination (Turkish rounded-front stems are the worked
   case); the `taka` / `gün lar` pair shows a spaced gold can *cause* the miss.
4. Verify Phase-1 events on the production deployment, then start counting
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
