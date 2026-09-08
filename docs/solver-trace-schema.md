# Solver Trace Schema

## Purpose

Capture human solver behavior in the daily linguistics game to support:
1. **Last Translation Benchmark V2 contributions** — IOL-style problems with solver reasoning traces
2. **Human-AI comparison research** — where humans vs. models struggle
3. **Training data augmentation** — synthetic problem generation informed by real solver strategies

## Data Collection Points

### Session Start (page load)
```jsonl
{
  "event": "session_start",
  "timestamp": "2026-09-07T14:32:01.234Z",
  "session_id": "uuid-v4",
  "puzzle_id": "apurina_kinship",
  "puzzle_date": "2026-09-07",
  "user_agent": "Mozilla/5.0...",
  "viewport": {"width": 1920, "height": 1080},
  "device_type": "desktop" // or "mobile", "tablet"
}
```

### Study Phase
```jsonl
{
  "event": "study_complete",
  "timestamp": "2026-09-07T14:34:15.678Z",
  "session_id": "uuid-v4",
  "study_duration_ms": 134444,
  "evidence_drawer_opens": 2, // how many times they opened the drawer
  "gated_pairs_revealed": ["pair_1", "pair_3"], // which gated evidence they unlocked
  "evidence_interaction": [
    {"row_id": "ev_1", "dwell_time_ms": 8234, "clicks": 1},
    {"row_id": "ev_2", "dwell_time_ms": 3421, "clicks": 0},
    {"row_id": "gated_1", "dwell_time_ms": 12456, "clicks": 2}
  ]
}
```

### Solve Phase — Tile Placements
```jsonl
{
  "event": "tile_placed",
  "timestamp": "2026-09-07T14:35:02.123Z",
  "session_id": "uuid-v4",
  "query_index": 0, // which query (0-indexed)
  "position": 2, // position in the answer (0-indexed)
  "tile_id": "tile_ma", // morpheme ID from the tile bank
  "tile_text": "ma",
  "elapsed_solve_ms": 46445, // time since study_complete
  "current_answer": ["u", "ku", "ma"] // state after this placement
}
```

```jsonl
{
  "event": "tile_removed",
  "timestamp": "2026-09-07T14:35:08.456Z",
  "session_id": "uuid-v4",
  "query_index": 0,
  "position": 1,
  "tile_id": "tile_ku",
  "elapsed_solve_ms": 52778,
  "current_answer": ["u", "", "ma"] // state after removal
}
```

### Submit & Grade
```jsonl
{
  "event": "submit",
  "timestamp": "2026-09-07T14:36:10.789Z",
  "session_id": "uuid-v4",
  "attempt_number": 1, // 1st, 2nd, or 3rd (forfeit) attempt
  "total_solve_time_ms": 115333,
  "answers": [
    ["u", "ku", "ma"],
    ["u", "nawa"],
    ["i", "ru"]
  ],
  "grades": [
    {"query_index": 0, "verdict": "correct", "em": 1.0},
    {"query_index": 1, "verdict": "wrong", "em": 0.0},
    {"query_index": 2, "verdict": "correct", "em": 1.0}
  ],
  "overall_verdict": "partial", // "correct", "partial", "wrong"
  "score": 0.67 // correct_count / total_queries
}
```

### Forfeit Flow
```jsonl
{
  "event": "forfeit",
  "timestamp": "2026-09-07T14:37:22.345Z",
  "session_id": "uuid-v4",
  "query_index": 1, // which query they revealed
  "attempt_number": 3, // always after 2 failed attempts
  "revealed_answer": ["u", "nawa", "txa"],
  "user_answer": ["u", "nawa"], // what they had before forfeit
  "total_attempts": 2
}
```

### AI Verdict (Modal solve)
```jsonl
{
  "event": "ai_verdict",
  "timestamp": "2026-09-07T14:38:05.123Z",
  "session_id": "uuid-v4",
  "modal_job_id": "job-xyz123",
  "modal_solve_time_ms": 8234,
  "ai_answers": [
    ["u", "ku", "ma"],
    ["u", "nawa", "txa"],
    ["i", "ru"]
  ],
  "ai_grades": [
    {"query_index": 0, "verdict": "correct", "em": 1.0},
    {"query_index": 1, "verdict": "correct", "em": 1.0},
    {"query_index": 2, "verdict": "correct", "em": 1.0}
  ],
  "ai_score": 1.0,
  "human_score": 0.67, // from the user's last submit
  "human_won": false
}
```

### Share
```jsonl
{
  "event": "share",
  "timestamp": "2026-09-07T14:38:30.456Z",
  "session_id": "uuid-v4",
  "share_grid": "🟢🔴🟢\n🤖1.00 😊0.67", // emoji grid copied to clipboard
  "final_human_score": 0.67,
  "final_ai_score": 1.0
}
```

## Storage Options

### Option 1: Local JSONL (MVP)
- Append events to `showcase/public/solver-traces.jsonl` (gitignored)
- Client-side `fetch('/api/log-trace', {method: 'POST', body: JSON.stringify(event)})`
- Vercel serverless route appends to a file in `/tmp` (ephemeral) or a persistent volume
- Export manually for analysis

**Pros:** Simple, no infrastructure
**Cons:** Ephemeral, no real-time analysis, privacy concerns if logged server-side

### Option 2: Neutron Canister Ledger (Privacy-First)
- Extend the attestation ledger to store anonymized solver traces
- Client hashes the `session_id` client-side before sending (SHA-256)
- Canister stores traces in stable memory, certified queries for retrieval
- Only aggregate statistics are public; raw traces require admin token

**Pros:** Certified, on-chain, privacy-preserving, aligns with "Honest Compute" narrative
**Cons:** Canister memory cost (~$0.50/GB/month on ICP mainnet), requires agent relay

### Option 3: Client-Side Analytics Only (No Server)
- Use Vercel Analytics events (`track('tile_placed', {query_index, tile_id, ...})`)
- Aggregate metrics only (no raw traces, no PII)
- Export via Vercel dashboard

**Pros:** Zero infrastructure, GDPR-friendly
**Cons:** Limited queryability, no raw traces for research

## Recommended Approach

**Start with Option 3 (analytics events) + Option 1 (opt-in JSONL export)**

1. **Default behavior:** Track aggregate events via `lib/analytics.ts` (`trackEvent('tile_placed', {...})`) — no server storage
2. **Opt-in research mode:** Add a "Help improve IOL research" toggle in settings that:
   - Shows a consent banner explaining data use (anonymized, research-only)
   - Client-side generates a persistent `research_id` (localStorage, SHA-256 hash of random seed)
   - Logs full traces to `/api/log-trace` only if opted in
   - Displays a "You're contributing to linguistics research!" badge

3. **Privacy by design:**
   - No IP addresses, no device fingerprints
   - `session_id` is rotated daily (not tied to user identity)
   - Traces are anonymized before storage (hash all IDs client-side)
   - Clear data retention policy (delete after 1 year, or when LTB V2 is published)

## Data Analysis Use Cases

### 1. Hard Problem Detection
```sql
-- Find queries with low solve rate (good candidates for LTB)
SELECT puzzle_id, query_index,
       AVG(CASE WHEN verdict = 'correct' THEN 1 ELSE 0 END) AS solve_rate,
       AVG(total_solve_time_ms) AS avg_time_ms
FROM submit_events
GROUP BY puzzle_id, query_index
HAVING solve_rate < 0.3
ORDER BY solve_rate ASC;
```

### 2. Tile Reuse Patterns
```sql
-- Which morphemes are used in wrong positions (confusion matrix)
SELECT tile_id, query_index, position, COUNT(*) AS misuse_count
FROM tile_placed_events
WHERE session_id IN (SELECT session_id FROM submit_events WHERE verdict = 'wrong')
GROUP BY tile_id, query_index, position
ORDER BY misuse_count DESC;
```

### 3. Human vs AI Divergence
```sql
-- Queries where AI wins but humans struggle
SELECT puzzle_id, query_index,
       AVG(human_score) AS avg_human,
       AVG(ai_score) AS avg_ai,
       (AVG(ai_score) - AVG(human_score)) AS gap
FROM ai_verdict_events
GROUP BY puzzle_id, query_index
HAVING gap > 0.5
ORDER BY gap DESC;
```

## Next Steps

1. **Implement analytics tracking** in `showcase/app/play` components (study, solve, result phases)
2. **Add opt-in consent UI** (settings toggle + banner)
3. **Create Vercel API route** `/api/log-trace` for opt-in trace storage
4. **Write data export script** to convert JSONL → LTB format (see `ltb-export-schema.md`)
5. **Test on 10 real sessions** before announcing the research program
