# Interactive Puzzle UI — Product Plan

## Vision

A daily, interactive linguistics deduction game — Wordle meets IOL. Users crack the pattern of a real (often endangered) language by composing answers from morpheme tiles. No prior linguistic knowledge required; pure logic.

## Positioning (Thiel/Graham lens)

**Zero to One:** Everyone builds language-learning apps. Nobody has built a language-puzzle game. 400+ brilliant IOL problems exist but are trapped in PDFs. We have the credibility (IOL-AI competitor), the infrastructure (14B model on GPU for hints), and the evaluation protocol (Linguini EM + chrF scoring — already built).

**10x better than status quo:**
- IOL PDFs → interactive, bite-sized (2-5 min), mobile-first
- Langle/LinguaBoard → trivial identification vs actual deduction
- Duolingo → vocabulary drills vs cryptographic reasoning

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

### MVP (now): No auth
- Zero friction — open URL and play
- Problems hardcoded in the bundle (from 160 Linguini training set)
- Grading runs client-side (EM is string comparison, chrF is character n-gram)
- Daily rotation via date-seed (everyone gets the same puzzle, no server)
- State stored in localStorage only (current puzzle progress)

### Phase 2 (later): Internet Identity + canister
- Provable streaks (chain-key-signed solve records)
- Leaderboard by speed/accuracy
- "Language passport" — collect scripts you've cracked
- AI hints via HTTPS outcall (costs GPU time, needs auth to prevent abuse)

## Share Card

On completion, generate a shareable image/text:

```
🧩 Ration #42 — Apurinã
⬛⬛🟩 → 🟩🟩🟩
Solved in 3:42 · 1 hint used
ratiocine.vercel.app/play
```

Similar to Wordle's green/yellow squares — shows your journey without spoiling the answer.

## MVP Scope (build now)

1. One puzzle: Apurinã verb agreement (already in showcase as static content)
2. Morpheme tile bank + drop-zone answer slots
3. Context highlighting (tap a word, see its pattern)
4. Submit → grade (client-side EM check, green/amber/grey tiles)
5. 3 progressive hints
6. Mac teaser → full-screen transition (desktop); direct puzzle (mobile)
7. Share card text generation
8. Mobile-responsive (tap-to-place)
9. Timer (optional display, used for share card)

## Differentiation Table

| Feature | Wordle | Duolingo | IOL PDFs | Ration Play |
|---------|--------|----------|----------|-------------|
| Daily puzzle | ✓ | ✓ | ✗ | ✓ |
| Pattern deduction | ✗ | ✗ | ✓ | ✓ |
| Interactive affordances | ✓ | ✓ | ✗ | ✓ (tiles) |
| Real/endangered languages | ✗ | major only | ✓ | ✓ |
| Progressive hints | ✗ | ✓ | ✗ | ✓ |
| Provable solve record | ✗ | ✗ | ✗ | ✓ (Phase 2) |
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
