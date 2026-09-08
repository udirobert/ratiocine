# Research Progress Tracker

**Last Updated:** 2026-09-07

---

## Phase 1: Data Collection (Weeks 1-2)

### Planning ✅
- [x] Define solver trace schema
- [x] Design consent UI/UX
- [x] Plan analytics events
- [x] Evaluate storage options

### Implementation 🟢 In Progress
- [x] Create `ConsentBanner.tsx` component
- [x] Add consent toggle to settings (included in banner)
- [x] Extend `lib/analytics.ts` with trace events
- [ ] Instrument study phase (session_start, study_complete)
- [ ] Instrument solve phase (tile_placed, tile_removed)
- [ ] Instrument submit & grade (submit event)
- [ ] Instrument AI verdict comparison
- [x] Create `/api/log-trace` route (Vercel serverless)
- [x] Add `TRACE_SALT` to `.env`
- [x] Create `/privacy` page
- [ ] Install dependencies (`cd showcase && npm install`)
- [ ] Test locally (consent flow, event logging)
- [ ] Deploy to Vercel preview
- [ ] Privacy audit (no PII, hashed session IDs)
- [ ] Merge to main
- [ ] Announce to users (toast or social post)

**Current Status:** Core infrastructure complete (banner, analytics, API, privacy page). Next: install deps, instrument game components, test.

**See:** `PHASE1_IMPLEMENTATION_STATUS.md` for detailed status + testing checklist.

**Success Metric:** 20+ opt-in sessions/day after 1 week

---

## Phase 2: LTB Contribution Prep (Weeks 3-4)

### Data Export 🔵
- [ ] Convert `puzzle-data.ts` → `puzzles.json`
- [ ] Implement `scripts/export_to_ltb.py`
- [ ] Generate verification rules for all 25 queries
- [ ] Add linguistic annotations (map to LTB categories)
- [ ] Export to `data/ltb_export.json`

### Model Testing 🔵
- [ ] Run Qwen2.5-14B-AWQ on all 25 queries
- [ ] Run Gemini 2.5 Flash on all 25 queries
- [ ] Run GPT-5 on all 25 queries (if Arkor rate limits allow)
- [ ] Store predictions in `data/ltb_model_outputs.json`
- [ ] Verify at least 1 model breaks on each query

### LTB Submission 🔵
- [ ] Write 1-page summary (`docs/ltb_submission_summary.md`)
- [ ] Register as contributor on LTB website
- [ ] Submit 1-2 example problems (proof of concept)
- [ ] Address review feedback (if any)
- [ ] Batch-submit remaining 23 queries

**Success Metric:** 2+ problems accepted into LTB V2, authorship credit confirmed

---

## Phase 3: Technical Report Publication (Weeks 5-6)

### Report Finalization 🔵
- [ ] Fill in "TBD" sections (final rank, human jury results)
- [ ] Create `docs/error-analysis.csv` (50 hand-labeled cases)
- [ ] Add Appendix C (error case examples)
- [ ] Proofread for clarity and accuracy
- [ ] Format for arXiv submission (if choosing arXiv route)

### Publication 🔵
- [ ] Decide: arXiv or GitHub-only?
- [ ] Decide: Wait for private leaderboard or publish now?
- [ ] Submit to arXiv (if yes to arXiv)
- [ ] Write blog post / announcement
- [ ] Tweet thread with key findings
- [ ] Post to Reddit (r/MachineLearning, r/LanguageTechnology)
- [ ] Post to Hacker News (if blog post is live)
- [ ] Email IOL organizers (share the report)

**Success Metric:** 100+ GitHub stars, 5+ citations by IOL-AI 2027

---

## Phase 4: Continuous Growth (Ongoing)

### Monthly Cadence 🟡
- [ ] Export solver traces → LTB format (monthly)
- [ ] Submit batch LTB contributions (quarterly)
- [ ] Update technical report with new findings (as needed)
- [ ] Expand puzzle bank (5 → 10 → 20 puzzles)
- [ ] Accept community puzzle contributions (via GitHub PRs)

### Research Partnerships 🟡
- [ ] Reach out to IOL organizers (collaboration opportunities)
- [ ] Connect with MT researchers using LTB
- [ ] Connect with low-resource NLP labs
- [ ] Propose workshop paper (ACL 2027, EMNLP 2027)

**Success Metric:** 500+ traces/month, 10+ LTB contributions/quarter, 50+ citations by 2028

---

## Open Decisions

| Decision | Options | Status | Notes |
|----------|---------|--------|-------|
| Technical report format | arXiv vs GitHub-only | 🔵 Undecided | Recommendation: GitHub now, arXiv later |
| Publication timing | Wait for private leaderboard vs publish now | 🔵 Undecided | Recommendation: Publish with "TBD" placeholders |
| Solver trace dataset | Full open-source vs aggregate-only | 🔵 Undecided | Recommendation: Aggregate-only for now |
| Formal venue submission | ACL/EMNLP vs workshop vs none | 🔵 Undecided | Recommendation: Workshop in 2027 if interest |

---

## Timeline Summary

| Week | Phase | Key Milestone | Status |
|------|-------|--------------|--------|
| 1-2 | Phase 1 | Solver trace logger live | 🔵 Ready to start |
| 3-4 | Phase 2 | 1-2 problems submitted to LTB | 🔵 Ready to start |
| 5-6 | Phase 3 | Technical report published | 🔵 Ready to start |
| 7+ | Phase 4 | Monthly trace exports + LTB batches | 🟡 Long-term |

**Next session start here:** Phase 1, Task 1.1 (Create ConsentBanner.tsx)

---

## Resources

**Planning Docs:**
- `docs/solver-trace-schema.md` — data format
- `docs/ltb-export-schema.md` — LTB submission format
- `docs/iol-2026-technical-report.md` — competition report draft
- `docs/research-roadmap.md` — 4-phase plan
- `docs/phase1-implementation.md` — Week 1-2 checklist
- `RESEARCH_NEXT_STEPS.md` — executive summary

**External Links:**
- Last Translation Benchmark: https://huggingface.co/datasets/zouhar/last-translation-benchmark
- LTB submission site: https://last-translation-benchmark.vilda.net
- LTB paper: https://arxiv.org/abs/2609.04173
- Linguini benchmark: https://huggingface.co/datasets/linguini/linguini
- IOL official site: https://ioling.org

**Contact:**
- GitHub: https://github.com/udirobert/ratiocine
- Project site: https://ratiocine.trustfall.xyz
- Daily game: https://ratiocine.trustfall.xyz/play
