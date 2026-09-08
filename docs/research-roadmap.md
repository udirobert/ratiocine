# Research & Community Roadmap

## Overview

This document ties together our three research deliverables:
1. **Solver trace collection** → capture human reasoning strategies
2. **LTB export** → contribute IOL problems to translation benchmarks
3. **Technical report** → baseline for future IOL-AI competitions

Together, these position the Ratiocine project as both a competitive IOL-AI system AND a research platform for morphological reasoning.

---

## Phase 1: Data Collection (Weeks 1-2)

### Goal
Instrument the daily game to log anonymized solver traces.

### Tasks
- [ ] Add analytics events to `showcase/app/play` (study, solve, submit phases)
- [ ] Implement opt-in consent UI (settings toggle + banner)
- [ ] Create Vercel API route `/api/log-trace` for trace storage
- [ ] Test on 10 real sessions (dogfood internally before public launch)

### Deliverables
- `showcase/app/api/log-trace/route.ts` (serverless trace logger)
- `showcase/app/play/components/ConsentBanner.tsx` (opt-in UI)
- Updated `lib/analytics.ts` with all solver events

### Success Metrics
- 20+ opt-in sessions per day after launch
- Zero PII/IP leaks (privacy audit passes)
- Trace JSONL is parseable and complete (no missing fields)

---

## Phase 2: LTB Contribution Prep (Weeks 3-4)

### Goal
Convert our 5 puzzles (25 queries total) into LTB V2 submission format.

### Tasks
- [ ] Manually convert `puzzle-data.ts` → `puzzles.json` (structured export)
- [ ] Implement `scripts/export_to_ltb.py` (see `docs/ltb-export-schema.md`)
- [ ] Run our 14B model on all 25 queries (capture predictions)
- [ ] Run 3 SOTA models (Gemini, GPT, Claude) on same queries (show they break)
- [ ] Write 1-page summary explaining why IOL problems are valuable for LTB
- [ ] Submit 1-2 example problems to test the review process

### Deliverables
- `data/ltb_export.json` (25 LTB-formatted entries)
- `scripts/export_to_ltb.py` (reusable export script)
- `docs/ltb_submission_summary.md` (1-page pitch)
- Model predictions stored in `data/ltb_model_outputs.json`

### Success Metrics
- 1-2 problems accepted into LTB V2 (proof of concept)
- Review feedback is positive (rules are objective, linguistics tags are accurate)
- Authorship credit confirmed for V2 paper

---

## Phase 3: Technical Report Publication (Weeks 5-6)

### Goal
Publish the IOL-AI 2026 technical report as a baseline for future competitions.

### Tasks
- [ ] Fill in TBD sections (final rank, human jury results)
- [ ] Add Appendix C (50 error case examples)
- [ ] Create `docs/error-analysis.csv` (labeled failure cases)
- [ ] Proofread and format for arXiv submission
- [ ] Submit to arXiv (cs.CL category)
- [ ] Announce on Twitter/HN/Reddit (link to GitHub, HF model, daily game)

### Deliverables
- `docs/iol-2026-technical-report.md` (complete, proofread)
- `docs/error-analysis.csv` (50 hand-labeled cases)
- arXiv preprint (if desired for citations)
- Blog post / announcement thread

### Success Metrics
- 100+ GitHub stars (community interest)
- 5+ citations in IOL-AI 2027 papers (becomes a baseline reference)
- Featured in IOL/NLP newsletters (e.g., NLP News, Papers with Code)

---

## Phase 4: Continuous Dataset Growth (Ongoing)

### Goal
Use the daily game as a self-sustaining data collection engine.

### Long-Term Strategy
1. **Monthly exports** — convert each month's solver traces into LTB format, submit batch contributions
2. **Community puzzles** — accept user-submitted puzzles (via GitHub PRs), expand from 5 → 20+ puzzles
3. **Seasonal IOL-AI prep** — release updated training data before each competition
4. **Research partnerships** — collaborate with IOL organizers, MT researchers, low-resource NLP labs

### Metrics to Track
- Solver traces per month (target: 500+)
- LTB contributions per quarter (target: 10+)
- Citations to our dataset/models (target: 50+ by 2028)
- GitHub contributors (target: 10+ by 2027)

---

## Integration with Neutron Canister

### Option: Store Traces On-Chain

If we want a "certified reasoning logbook" for solver traces (not just AI attestations), we can extend the Neutron canister:

**New method: `attest_human_solve`**
```motoko
public func attest_human_solve(input : {
    puzzle_id : Text;
    query_index : Nat;
    session_id_hash : Text;  // SHA-256, no PII
    answer : [Text];
    verdict : Text;  // "correct" | "wrong" | "partial"
    solve_time_ms : Nat;
    timestamp : Int;
}) : async Result<LedgerEntry, Text> {
    // Same grading logic as AI attestation
    // Append to the same ledger (human vs AI is marked by a field)
    // Chain-key sign the entry
}
```

**Why this is interesting:**
- **Certified human reasoning traces** — immutable, on-chain proof that a human solved this problem at this time
- **Human-AI comparison dataset** — both are in the same ledger, same grading function, same certification
- **Deduction Theatre extension** — the game already shows "Deduction Theatre" for AI solves; now we can show it for human solves too (certified thinking time, certified EM score)

**Tradeoff:** Canister memory cost (~$0.50/GB/month on ICP mainnet). If we log 1000 solves/month at ~1KB each, that's 1MB/month = $0.0005/month (negligible). The bigger question is whether on-chain storage adds value vs. a simple Vercel JSONL append.

**Decision:** Start with Vercel JSONL (Phase 1), evaluate canister storage in Phase 4 if we want certified traces for research reproducibility claims.

---

## Timeline Summary

| Phase | Duration | Key Deliverable | Status |
|-------|----------|----------------|--------|
| **Phase 1: Data Collection** | Weeks 1-2 | Solver trace logger live | 🔵 Ready to start |
| **Phase 2: LTB Prep** | Weeks 3-4 | 1-2 problems submitted to LTB V2 | 🔵 Ready to start |
| **Phase 3: Tech Report** | Weeks 5-6 | arXiv preprint published | 🔵 Ready to start |
| **Phase 4: Continuous Growth** | Ongoing | Monthly LTB batches, 500+ traces/month | 🟡 Long-term |

**Estimated total effort:** 6 weeks of focused work (1-2 hours/day) to complete Phases 1-3. Phase 4 is maintenance mode (1 hour/week).

---

## Open Questions

1. **Do we want an arXiv preprint or just a GitHub technical report?**
   - **arXiv:** Citable, shows up on Papers with Code, more formal
   - **GitHub:** Faster to publish, easier to update, no submission gatekeeping

2. **Should we wait for IOL-AI 2026 private leaderboard results before publishing?**
   - **Wait:** Final rank is a stronger narrative ("we placed Xth out of Y teams")
   - **Publish now:** Document the process while it's fresh, update the rank later

3. **Do we open-source the full solver trace dataset?**
   - **Yes:** Maximizes research impact, aligns with our "open everything" ethos
   - **No:** Privacy concerns (even anonymized traces could be de-anonymized if combined with other data)
   - **Compromise:** Aggregate statistics public, raw traces available on request with a data use agreement

4. **Should we target a formal publication venue (e.g., ACL 2027, EMNLP 2027)?**
   - **Pro:** Peer review, higher visibility, academic credibility
   - **Con:** 6-month review cycle, formatting requirements, rebuttal stress
   - **Alternative:** ACL workshop (e.g., Low-Resource NLP, Computational Linguistics Olympiad)

---

## Recommended Next Steps (Today)

1. **Start Phase 1** — implement the consent banner and analytics events (2 hours)
2. **Convert puzzle-data.ts → puzzles.json** — structured export for scripting (30 min)
3. **Run 14B model on all 25 queries** — capture predictions for LTB export (1 hour)
4. **Draft the LTB 1-page summary** — why IOL problems matter for MT research (1 hour)

Total: ~4.5 hours of work to unlock Phases 2-3.

---

## Success Definition

By the end of Phase 3 (6 weeks), we should have:
- ✅ **500+ human solver traces** logged and analyzable
- ✅ **2+ IOL problems accepted into LTB V2** with authorship credit
- ✅ **Technical report published** (arXiv or GitHub) as the IOL-AI 2026 baseline
- ✅ **100+ GitHub stars** from the NLP/IOL community
- ✅ **5+ citations** in other researchers' IOL-AI work

This positions us as **the reference implementation** for IOL-AI research, not just a one-off competition entry.
