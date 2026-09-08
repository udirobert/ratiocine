# Phase 1 Implementation Checklist

## Goal
Instrument the daily game to collect anonymized solver traces with opt-in consent.

**Timeline:** Weeks 1-2 (estimated 6-8 hours total)

---

## Task 1: Consent UI (2 hours)

### 1.1 Create Consent Banner Component

**File:** `showcase/app/play/components/ConsentBanner.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage for existing consent decision
    const consent = localStorage.getItem('ration-research-consent');
    if (consent === null) {
      setVisible(true); // Show banner if no decision yet
    } else {
      setHasConsented(consent === 'true');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('ration-research-consent', 'true');
    setHasConsented(true);
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('ration-research-consent', 'false');
    setHasConsented(false);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
        >
          <div className="card-solid p-4 border-2 border-puzzle-accent/30">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🔬</span>
              <div>
                <h3 className="font-bold text-sm mb-1">Help improve linguistics research</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  We'd like to collect anonymized data about how you solve puzzles (tile placements,
                  study time, attempts) to contribute to translation benchmarks and IOL research.
                  No personal data is collected.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 px-3 py-2 text-xs font-medium bg-puzzle-accent/20 hover:bg-puzzle-accent/30
                         rounded border border-puzzle-accent/50 transition"
              >
                I'm in
              </button>
              <button
                onClick={handleDecline}
                className="px-3 py-2 text-xs text-white/60 hover:text-white/80 transition"
              >
                No thanks
              </button>
            </div>
            <a
              href="/privacy"
              className="block mt-2 text-xs text-puzzle-accent/70 hover:text-puzzle-accent underline"
            >
              Learn more about data use
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 1.2 Add Consent Indicator to Settings

**File:** `showcase/app/play/components/SettingsPanel.tsx` (or create if doesn't exist)

Add a toggle to show current consent status and allow users to change it:

```tsx
const [researchConsent, setResearchConsent] = useState<boolean>(false);

useEffect(() => {
  const consent = localStorage.getItem('ration-research-consent');
  setResearchConsent(consent === 'true');
}, []);

const toggleConsent = () => {
  const newValue = !researchConsent;
  localStorage.setItem('ration-research-consent', String(newValue));
  setResearchConsent(newValue);
};

// In the render:
<div className="flex items-center justify-between">
  <div>
    <div className="font-medium text-sm">Research Data Sharing</div>
    <div className="text-xs text-white/60">
      Help improve IOL research with anonymized solver traces
    </div>
  </div>
  <button
    onClick={toggleConsent}
    className={`relative w-12 h-6 rounded-full transition ${
      researchConsent ? 'bg-puzzle-accent' : 'bg-white/20'
    }`}
  >
    <span
      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
        researchConsent ? 'translate-x-6' : ''
      }`}
    />
  </button>
</div>
```

### 1.3 Show Research Badge (Optional)

If user has consented, show a subtle badge:

```tsx
{hasConsented && (
  <div className="fixed top-4 right-4 text-xs px-2 py-1 bg-puzzle-accent/10 border border-puzzle-accent/30 rounded-full text-puzzle-accent/80">
    <span className="mr-1">🔬</span> Contributing to research
  </div>
)}
```

---

## Task 2: Analytics Events (3 hours)

### 2.1 Extend `lib/analytics.ts`

Add new event types for solver traces:

```typescript
export type SolverEvent =
  | { type: 'session_start', data: SessionStartData }
  | { type: 'study_complete', data: StudyCompleteData }
  | { type: 'tile_placed', data: TilePlacedData }
  | { type: 'tile_removed', data: TileRemovedData }
  | { type: 'submit', data: SubmitData }
  | { type: 'forfeit', data: ForfeitData }
  | { type: 'ai_verdict', data: AIVerdictData };

export function trackSolverEvent(event: SolverEvent) {
  // Only track if user has consented
  const consent = localStorage.getItem('ration-research-consent');
  if (consent !== 'true') return;

  // Track via Vercel Analytics (aggregate only)
  track(event.type, event.data);

  // If opted in, also send to trace logger
  sendToTraceLogger(event);
}

async function sendToTraceLogger(event: SolverEvent) {
  try {
    await fetch('/api/log-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event.data,
        event: event.type,
        timestamp: new Date().toISOString(),
        session_id: getOrCreateSessionId(),
      }),
    });
  } catch (err) {
    // Silent fail — don't break the game if logging fails
    console.debug('Trace logging failed:', err);
  }
}

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem('ration-session-id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ration-session-id', sessionId);
  }
  return sessionId;
}
```

### 2.2 Instrument Study Phase

**File:** `showcase/app/play/scenes/StudyScene.tsx` (or wherever the study phase lives)

```tsx
useEffect(() => {
  // Track session start
  trackSolverEvent({
    type: 'session_start',
    data: {
      puzzle_id: puzzle.id,
      puzzle_date: getTodaysPuzzle().date,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
    },
  });
}, [puzzle.id]);

const handleStudyComplete = () => {
  trackSolverEvent({
    type: 'study_complete',
    data: {
      study_duration_ms: Date.now() - studyStartTime,
      evidence_drawer_opens: drawerOpenCount,
      gated_pairs_revealed: revealedGatedPairs,
      evidence_interaction: evidenceRows.map(row => ({
        row_id: row.id,
        dwell_time_ms: row.dwellTime,
        clicks: row.clicks,
      })),
    },
  });
  // Continue to solve phase...
};
```

### 2.3 Instrument Solve Phase (Tile Placements)

**File:** `showcase/app/play/scenes/SolveScene.tsx`

```tsx
const handleTilePlaced = (queryIndex: number, position: number, tile: Tile) => {
  trackSolverEvent({
    type: 'tile_placed',
    data: {
      query_index: queryIndex,
      position,
      tile_id: tile.id,
      tile_text: tile.text,
      elapsed_solve_ms: Date.now() - solveStartTime,
      current_answer: getCurrentAnswer(queryIndex),
    },
  });
  // Update UI state...
};

const handleTileRemoved = (queryIndex: number, position: number, tile: Tile) => {
  trackSolverEvent({
    type: 'tile_removed',
    data: {
      query_index: queryIndex,
      position,
      tile_id: tile.id,
      elapsed_solve_ms: Date.now() - solveStartTime,
      current_answer: getCurrentAnswer(queryIndex),
    },
  });
  // Update UI state...
};
```

### 2.4 Instrument Submit & Grade

```tsx
const handleSubmit = async () => {
  const grades = await gradeAnswers(userAnswers);

  trackSolverEvent({
    type: 'submit',
    data: {
      attempt_number: attemptCount,
      total_solve_time_ms: Date.now() - solveStartTime,
      answers: userAnswers,
      grades: grades.map((g, i) => ({
        query_index: i,
        verdict: g.verdict,
        em: g.em,
      })),
      overall_verdict: grades.every(g => g.verdict === 'correct') ? 'correct'
        : grades.some(g => g.verdict === 'correct') ? 'partial'
        : 'wrong',
      score: grades.filter(g => g.verdict === 'correct').length / grades.length,
    },
  });
};
```

### 2.5 Instrument AI Verdict

```tsx
const handleAIVerdict = (aiResult: AIResult) => {
  trackSolverEvent({
    type: 'ai_verdict',
    data: {
      modal_job_id: aiResult.jobId,
      modal_solve_time_ms: aiResult.solveTimeMs,
      ai_answers: aiResult.answers,
      ai_grades: aiResult.grades,
      ai_score: aiResult.score,
      human_score: lastHumanScore,
      human_won: lastHumanScore > aiResult.score,
    },
  });
};
```

---

## Task 3: Trace Logger API Route (1.5 hours)

### 3.1 Create Serverless Route

**File:** `showcase/app/api/log-trace/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { appendFile } from 'fs/promises';
import { join } from 'path';

// Note: This only works if Vercel has a persistent volume mounted.
// For MVP, we'll use an in-memory buffer and flush to a DB periodically.
// Or use Vercel Blob Storage (https://vercel.com/docs/storage/vercel-blob)

export async function POST(req: NextRequest) {
  try {
    const trace = await req.json();

    // Basic validation
    if (!trace.event || !trace.timestamp || !trace.session_id) {
      return NextResponse.json({ error: 'Invalid trace format' }, { status: 400 });
    }

    // Anonymize: hash the session_id server-side (double-hashed)
    const anonymizedSessionId = await hashSessionId(trace.session_id);

    const logEntry = {
      ...trace,
      session_id: anonymizedSessionId,
      ip: null, // Never log IP
      user_agent: null, // Never log full UA
    };

    // Write to storage (Vercel Blob, Postgres, or ephemeral file)
    await writeTrace(logEntry);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Trace logging error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function hashSessionId(sessionId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionId + process.env.TRACE_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function writeTrace(entry: any): Promise<void> {
  // Option 1: Vercel Blob (recommended)
  // const { put } = await import('@vercel/blob');
  // const filename = `traces/${entry.event}-${Date.now()}.json`;
  // await put(filename, JSON.stringify(entry), { access: 'private' });

  // Option 2: Append to JSONL (ephemeral, for local testing)
  const logPath = join('/tmp', 'solver-traces.jsonl');
  await appendFile(logPath, JSON.stringify(entry) + '\n');
}
```

### 3.2 Add Environment Variable

**File:** `.env` (gitignored)

```bash
TRACE_SALT="your-random-salt-here-32-chars"
```

**File:** `.env.example` (tracked)

```bash
# Solver trace logging (Phase 1 research)
TRACE_SALT="generate-a-random-32-char-string"
```

### 3.3 Install Vercel Blob (if using Option 1)

```bash
cd showcase
pnpm add @vercel/blob
```

---

## Task 4: Privacy Policy Page (1 hour)

### 4.1 Create Privacy Page

**File:** `showcase/app/privacy/page.tsx`

```tsx
export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy & Data Use</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">What We Collect (If You Opt In)</h2>
        <p className="mb-2">
          When you enable "Research Data Sharing" in the game, we collect anonymized solver traces:
        </p>
        <ul className="list-disc ml-6 space-y-1 text-sm">
          <li>Puzzle ID and query index</li>
          <li>Tile placements (morpheme selections)</li>
          <li>Study time, solve time, attempts</li>
          <li>Forfeit decisions and revealed answers</li>
          <li>Grading results (correct/wrong/partial)</li>
          <li>AI verdict comparison (human score vs model score)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">What We DO NOT Collect</h2>
        <ul className="list-disc ml-6 space-y-1 text-sm">
          <li>No IP addresses</li>
          <li>No device fingerprints</li>
          <li>No cookies (beyond localStorage consent flag)</li>
          <li>No personal identifiable information (PII)</li>
          <li>No cross-site tracking</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">How We Use This Data</h2>
        <p className="mb-2">Anonymized solver traces are used for:</p>
        <ul className="list-disc ml-6 space-y-1 text-sm">
          <li>Contributing to machine translation benchmarks (e.g., Last Translation Benchmark V2)</li>
          <li>Analyzing human reasoning strategies for linguistics research</li>
          <li>Improving the game's puzzle design and difficulty calibration</li>
          <li>Publishing aggregate statistics in research papers</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
        <p className="text-sm">
          Traces are stored for up to 1 year or until research publication (whichever comes first).
          After publication, raw traces are deleted and only aggregate statistics are retained.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
        <ul className="list-disc ml-6 space-y-1 text-sm">
          <li>Opt in or out at any time via the game settings</li>
          <li>No penalty for declining — the game works identically either way</li>
          <li>Request deletion of your traces (email us with your session ID hash)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Contact</h2>
        <p className="text-sm">
          Questions? Email us at <a href="mailto:research@trustfall.xyz" className="text-puzzle-accent underline">research@trustfall.xyz</a>
        </p>
      </section>
    </div>
  );
}
```

---

## Task 5: Testing (1.5 hours)

### 5.1 Local Testing Checklist

- [ ] Consent banner appears on first visit
- [ ] "I'm in" → banner dismisses, localStorage flag set to "true"
- [ ] "No thanks" → banner dismisses, localStorage flag set to "false"
- [ ] Settings toggle reflects current consent status
- [ ] Settings toggle can change consent decision (re-triggers consent logic)
- [ ] Trace events are logged to `/api/log-trace` ONLY when consented
- [ ] Trace events are NOT logged when user declined
- [ ] Session ID is generated once per session (sessionStorage)
- [ ] Privacy page renders correctly and explains data use clearly

### 5.2 Production Testing (Vercel Preview)

- [ ] Deploy to Vercel preview
- [ ] Test on mobile viewport (consent banner is readable, buttons are tappable)
- [ ] Check Vercel Logs for successful trace writes
- [ ] Verify no PII in logs (no IP, no full UA)
- [ ] Test from incognito window (fresh session ID)

### 5.3 Privacy Audit

- [ ] No IP addresses logged ✅
- [ ] Session IDs are hashed (SHA-256 + salt) ✅
- [ ] No cross-site cookies ✅
- [ ] Consent is required before any logging ✅
- [ ] User can revoke consent at any time ✅

---

## Task 6: Deployment (0.5 hours)

### 6.1 Merge Checklist

- [ ] All TypeScript types pass (`tsc --noEmit`)
- [ ] Consent banner tested on mobile + desktop
- [ ] Privacy page linked from banner
- [ ] `.env.example` updated with `TRACE_SALT`
- [ ] Git commit message: "feat(research): add solver trace collection (Phase 1)"

### 6.2 Announce to Users

Once merged, add a brief changelog or announcement:

**Option 1: In-game toast**
```tsx
<Toast variant="info">
  🔬 New: Help improve IOL research! Enable "Research Data Sharing" in settings to contribute anonymized solver traces.
</Toast>
```

**Option 2: Tweet/social post**
```
We're now collecting anonymized solver traces from our daily linguistics game to contribute to machine translation research.

Opt in to help build better language models that understand morphology, not just fluency. Privacy-first, no PII.

https://ratiocine.trustfall.xyz/play
```

---

## Success Metrics (Week 2)

After 1 week in production:
- [ ] 20+ users opted in (10% conversion from daily active users)
- [ ] 500+ trace events logged (study, solve, submit phases)
- [ ] Zero privacy incidents (no PII logged, no user complaints)
- [ ] Trace JSONL is parseable and complete (all required fields present)

**If successful, proceed to Phase 2 (LTB export prep).**

---

## Notes

- **Vercel Blob vs ephemeral `/tmp`**: For MVP, `/tmp` is fine (traces are lost on function restart, but good for testing). For production, use Vercel Blob or a Postgres DB (Vercel Postgres has a generous free tier).
- **GDPR compliance**: Because we collect NO PII (not even hashed emails), we're exempt from most GDPR requirements. The consent banner is a courtesy, not a legal requirement.
- **Session ID rotation**: We use `sessionStorage` (rotates per browser session), not `localStorage` (persistent). This limits tracking to a single play session (~10 min).
