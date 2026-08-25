# Interactive Puzzle UI — Product Plan

## Vision

A daily, interactive linguistics deduction game — Wordle meets IOL. Users crack the pattern of a real (often endangered) language by composing answers from morpheme tiles. No prior linguistic knowledge required; pure logic.

## Positioning (Thiel/Graham lens)

**Zero to One:** Everyone builds language-learning apps. Nobody has built a language-puzzle game where you and a machine solve the same problem, graded by the same rules, compared side by side. 400+ brilliant IOL problems exist but are trapped in PDFs. We have the credibility (IOL-AI competitor), the infrastructure (14B model on GPU), and the evaluation protocol (Linguini EM + chrF scoring — already built).

**10x better than status quo:**
- IOL PDFs → interactive, bite-sized (2-5 min), mobile-first
- Langle/LinguaBoard → trivial identification vs actual deduction
- Duolingo → vocabulary drills vs genuine reasoning
- Every other puzzle game → no honest comparison with a machine on the same task

## Why Ration matters here (and how to talk about it)

The value isn't "your streak is on-chain." Most people will never verify a
signature and shouldn't need to. The value is:

1. **The comparison is the content.** You solved Apurinã in 3:42 with 1 hint.
   The machine solved it in 36 seconds with 0 hints. Both got EM=1.0. That
   side-by-side result — graded identically by the same algorithm — is
   inherently interesting and shareable. The infrastructure makes the
   comparison *honest*; the comparison is what people care about.

2. **Ceremony creates meaning.** The GPU cold-boots, thinks for 36 seconds,
   the canister grades and signs. That weight makes the achievement feel real
   in a way "✅ Correct!" doesn't. It's closer to receiving a diploma than
   checking a checkbox — not because anyone verifies the diploma daily, but
   because it was non-trivially produced and permanently recorded.

3. **The "same surface" pattern has legs.** Placing human and machine on the
   exact same evaluation substrate — same puzzle, same grading code, same
   timestamp — establishes a reusable pattern for education, assessment, and
   AI benchmarking. The game is the demo; the pattern is the long-term asset.

**Lead with:** "You and the machine solved the same puzzle. Here's how you compared."

**Don't lead with:** "provable," "verifiable," "on-chain," or any
infrastructure terminology. The cryptography is the quiet proof underneath,
not the headline.

## The Mac as Ceremony

The floating Macintosh (3D GLB + CRT shader, 562×408 CanvasTexture) is the **gateway**, not the container:

1. User arrives → sees the Mac (default scene)
2. CRT screen shows a teaser: language name, script sample, "PLAY" button
3. User clicks Play → Mac zooms forward/fades, full-screen puzzle UI takes over (framer-motion transition)
4. On completion, Mac fades back showing the score/receipt on its screen
5. Mobile (< 768px): skip the Mac, go straight to puzzle UI

## Core Interaction: Morpheme Mapping

The unique affordance — you **compose answers from pre-segmented morpheme tiles**:

### Context Panel
- Bilingual pairs displayed as a table
- Tap any word to highlight where the same morpheme pattern appears across other rows
- This is pattern-spotting assistance, not answer-giving

### Answer Slots
- Each query item has empty slots
- Drag (desktop) or tap-to-select + tap-slot (mobile) morpheme tiles into position
- Tiles snap into slots, can be removed/reordered

### Morpheme Bank
- Pre-extracted from the context examples
- Contains all necessary morphemes plus a few distractors
- Tiles are styled with the warm amber palette

### Feedback
- On submit: tiles turn green (correct position), amber (correct morpheme wrong slot), grey (wrong)
- Partial credit visible immediately
- Score displayed: EM + chrF (same protocol as the canister)

### Progressive Hints (3 per puzzle)
1. First hint: highlights a key row in the context ("look at rows 3 and 10")
2. Second hint: reveals one morpheme mapping ("kaa- = we inclusive")
3. Third hint: gives the segmentation rule for one query item

## Scene Integration

The puzzle becomes a 4th scene accessible from the Mac scene:

```
Problem · Machine · Answer · [Play button on Mac screen]
```

The "Play" CTA is overlaid on the Mac scene. Clicking it transitions to full-screen puzzle mode. On completion, results feed back to the Mac CRT as a receipt animation.

## Auth Strategy

### MVP (now): No auth, comparison as reward
- Zero friction — open URL and play
- Problems hardcoded in the bundle (from 160 Linguini training set)
- Grading runs client-side (EM is string comparison, chrF is character n-gram)
- Daily rotation via date-seed (everyone gets the same puzzle, no server)
- State stored in localStorage only (current puzzle progress)
- **On solve:** fire the AI comparison via Modal, show the side-by-side result
- The comparison IS the reward — "you and the machine, graded the same way"

### Phase 2 (when the game works as a game): Ration receipts
Only pursue this after validating that people enjoy the core loop.
- The handoff bridge is already built (`createApurinaComparisonUrl`)
- Ration canister grades + signs the comparison (human outcome + AI result)
- The receipt adds ceremony and permanence to an already-satisfying moment
- Streaks become "N consecutive signed receipts" — real, but not the pitch
- Leaderboards backed by receipts — honest, but secondary to the fun
- **Key principle:** the crypto enables features; it is not itself a feature

## Share Card

On completion, generate a shareable image/text that highlights the comparison:

```
🧩 Ratiocine #42 — Apurinã
You: 3:42 · 1 hint · EM 1.0
AI:  0:36 · 0 hints · EM 1.0
⬛⬛🟩 → 🟩🟩🟩
ratiocine.vercel.app/play
```

The comparison is the hook — not "I solved it" but "here's how I stacked up against a 14B-parameter model on the same puzzle, graded by the same rules."

## MVP Scope (build now)

The core loop: **solve → compare → share.**

1. One puzzle: Apurinã verb agreement (already in showcase as static content)
2. Morpheme tile bank + drop-zone answer slots
3. Context highlighting (tap a word, see its pattern)
4. Submit → grade (client-side EM check, green/amber/grey tiles)
5. 3 progressive hints
6. Mac teaser → full-screen transition (desktop); direct puzzle (mobile)
7. **On solve: AI comparison.** Fire the same puzzle to Modal, show the machine's attempt graded by the same algorithm, side by side with the human result. This is the reward moment. Results are cached locally (no redundant GPU calls on revisit). Retry available on error. Share button gates on comparison completion.
8. Share card text generation (includes both human and AI scores)
9. Mobile-responsive (tap-to-place)
10. Timer (optional display, used for share card + comparison)

## Differentiation Table

| Feature | Wordle | Duolingo | IOL PDFs | Ration Play |
|---------|--------|----------|----------|-------------|
| Daily puzzle | ✓ | ✓ | ✗ | ✓ |
| Pattern deduction | ✗ | ✗ | ✓ | ✓ |
| Interactive affordances | ✓ | ✓ | ✗ | ✓ (tiles) |
| Real/endangered languages | ✗ | major only | ✓ | ✓ |
| Progressive hints | ✗ | ✓ | ✗ | ✓ |
| Human vs AI comparison | ✗ | ✗ | ✗ | ✓ (same grading) |
| No prior knowledge needed | ✓ | ✗ | ✓ | ✓ |
| 2-5 minute session | ✓ | ✓ | ✗ | ✓ |

## Technical Notes

- Framework: Next.js (existing showcase)
- Animation: framer-motion (already installed)
- Drag: @dnd-kit or native HTML5 drag (evaluate)
- 3D: Three.js + react-three-fiber (existing Mac scene)
- Styling: Tailwind (existing)
- No server required for MVP
- Build target: `showcase/app/play/` route or integrated into main page as a scene
