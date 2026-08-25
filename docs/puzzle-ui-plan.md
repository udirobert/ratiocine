# Interactive Puzzle UI — Product Plan

## Vision

A daily linguistics deduction game — Wordle meets IOL. Users crack the pattern
of a real (often endangered) language by composing answers from morpheme tiles,
then watch a 14B-parameter model attempt the same puzzle. No prior linguistic
knowledge required; pure logic.

## Current architecture (as of August 2026)

```
ratiocine.vercel.app/
├── /          → Mac CRT landing (typewriter hero, 3D scene, Play CTA)
├── /play      → The game (standalone route, deep-linkable, shareable)
└── /explore   → IOL-AI build showcase (Problem/Machine/Answer scenes)

ratiocine.trustfall.xyz → CNAME to Vercel (API rewrites to Modal)
```

### Landing → Game transition

Desktop: CRT portal — clip-path expansion from CRT screen bounds with spring
ease, grain noise edge, CRT pre-flash glitch. PuzzleView pre-mounted (hidden
by clip). Mobile: direct splash → Play link → /play.

### Game phases

1. **Study** — unified briefing + evidence. Language name types in, metadata
   fades, evidence cards stagger in as specimen cards with themed source color.
   Ready button appears after all cards are visible.
2. **Solve** — morpheme tile composition. Progress bar fills per query. Hints
   are visual-only (row highlights, tile meaning reveals). Shake on wrong,
   chime on correct.
3. **Result** — celebration first (big score, card-flip grid, share button),
   then below the fold: AI comparison, solve trace, map, lore.

### Parametric theming

Each puzzle carries a `PuzzleTheme` (accent, sourceColor, bgTint). The entire
game shifts tonally per language without component changes.

## User funnel — steps to a win

| Step | Action | Time | Drop-off risk |
|------|--------|------|---------------|
| 1 | Land on `/` | 0s | Low (visual hook) |
| 2 | Watch CRT typewriter | ~3s | Passive (no action required) |
| 3 | Click "Play" | 3-5s | **Medium** — CTA must be obvious |
| 4 | Portal transition | ~1s | Zero (automated) |
| 5 | Study evidence cards | 20-40s | **Medium** — must feel like progress, not homework |
| 6 | Click "I see it" | 30-45s | Low (only appears when ready) |
| 7 | Solve Q1 (tutorial) | 15-30s | **Low** — designed to be findable |
| 8 | Solve Q2-Q5 | 60-120s | Medium (difficulty curve) |
| 9 | See result + AI comparison | ~5s | Zero (automated celebration) |
| 10 | Share | 0-10s | **High** — must feel effortless + rewarding |

**Total time to first win: ~2-4 minutes.**

**Key insight:** Steps 1-4 should feel like ONE motion (arrive → portal → game).
Steps 5-6 should feel like the game has already started (you're learning by
looking, not waiting for permission to play). The "tutorial" Q1 guarantees a
first win within 30 seconds of the solve phase starting.

## Viral hooks & engagement loops

### Share moment (Wordle model)
- **Format:** Emoji grid + human vs AI comparison + time
- **Hook:** "I beat a 14B model at linguistics" is inherently shareable
- **Friction:** One-tap copy to clipboard, no auth required
- **Enhancement opportunity:** Generate a shareable image (OG-sized) with the
  card-flip grid + comparison — more visual than text in social feeds

### Streak mechanics
- Daily puzzle rotation (date-seeded, same puzzle for everyone)
- Streak counter in localStorage (🔥N visible on result screen)
- Streak resets on miss — creates urgency
- **Enhancement opportunity:** "Streak at risk" notification (if we add
  service worker / push)

### Comparison as content
- The AI solve is the reward, not the receipt
- Each language produces a unique comparison narrative:
  "You got 5/5, the machine got 3/5 — you outperformed a 14B model on Apurinã"
- **Enhancement opportunity:** Weekly "human vs machine" leaderboard — aggregate
  win rates across all puzzles

### Return hooks
- "Tomorrow's puzzle: Guazacapán Xinka" teaser on result screen
- New language = new theme = visual novelty (parametric theming)
- **Enhancement opportunity:** "Challenge a friend" link with the same puzzle
  pre-loaded (no daily rotation for challenged puzzles)

## Optimisation opportunities

### Reduce steps to first interaction

**Current:** Land → watch typewriter (3s) → click Play → transition → study
**Better:** The typewriter IS interactive. What if tapping the CRT during the
typewriter immediately triggers the portal? Power users skip the animation.
First-time visitors watch it naturally.

### Make study feel like play

**Current:** Passive reading of evidence cards → "I see it" → solve
**Better:** The evidence cards ARE interactive. Tapping a source word could
flash-highlight where the same morpheme appears in other rows. This turns study
into pattern-discovery gameplay without adding a formal "study phase" step.

### Shorten time-to-share

**Current:** Solve all 5 → see result → scroll to share
**Better:** Share button visible immediately on the celebration screen (already
done). But also: auto-copy the share text on the final correct answer (with a
toast confirmation)? Removes one tap.

### Increase share conversion

**Current:** Text-based share card
**Better:** Visual share card (auto-generated image) with:
- The card-flip grid (colored ✓/✗)
- Human vs AI score comparison
- Language name + regional tint
- URL + QR code

This stands out more in social feeds than plain text.

### Second-session hook

**Current:** "More puzzles — Coming soon" teaser
**Better:** After first solve, show a "warmup" mini-puzzle (2 queries, trivial)
from the next day's language. Gives a taste without the full solve. Creates
anticipation + teaches the next language's aesthetics via the parametric theme.

## Positioning

**Lead with:** "Crack the pattern. Then watch the machine try."

**Don't lead with:** Infrastructure, "on-chain," "verifiable," or competition
history. The IOL-AI credibility is the footnote (CRT footer), not the headline.

**Comparison to contemporaries:**
- vs Wordle: Same daily loop, but the pattern is linguistic, not lexical
- vs Duolingo: Genuine reasoning, not vocabulary drills; the "opponent" is a real AI, not a point system
- vs IOL PDFs: Interactive, bite-sized, mobile-first, with instant grading + comparison
- vs every puzzle game: Nobody else offers an honest human vs machine comparison on the same task
