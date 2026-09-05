# Play UX Review – Verbosity & Mobile Viewport Issues

**Date:** September 5, 2026
**Feedback Summary:** Game experience is too verbose, needs progressive disclosure, content doesn't fit in mobile viewport, Swahili incorrectly labeled as "endangered"

---

## Critical Issues

### 1. **Swahili Factual Error** ⚠️ HIGH PRIORITY

**Location:** `showcase/app/play/puzzle-data.ts` (lines 375-395)

**Current State:**
```typescript
endangerment:
  "Not endangered — vigorous and expanding. It's an official language of the African Union, and the UN marks World Kiswahili Language Day every July 7.",
```

**BUT** in the study phase (`study-phase.tsx` lines 240-246), there's conditional logic that checks:
```typescript
{/endangered|critically|severely/i.test(puzzle.lore.endangerment) ? (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-red-400/30 text-red-300/60 font-mono">
    endangered
  </span>
) : (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300/60 font-mono">
    living
  </span>
)}
```

**The bug:** The regex test should correctly show "living" for Swahili, but **user reports seeing "endangered"**. Need to verify if there's a stale cache or if the badge is being shown incorrectly.

**Fix:**
- Verify the current display behavior
- Ensure Swahili shows the "living" badge (green)
- Double-check that speaker count accurately reflects "80 million+ and growing"

---

### 2. **Study Phase Verbosity**

**Location:** `showcase/app/play/study-phase.tsx`

**Problems:**
1. **Language title** (lines 192-211): Large animated character stagger is beautiful but takes precious vertical space
2. **Three metadata rows** (lines 213-244):
   - Region + speaker count (line 219-225)
   - Endangerment badge (lines 226-244)
   - Fun fact hook (lines 246-253)
3. **Task frame paragraph** (lines 255-262): Another text block
4. **All shown BEFORE evidence cards** — user has to scroll past 4 text blocks to see the actual puzzle data

**User complaint:** "tries to squeeze in paragraphs below the title before the game starts"

**Current vertical budget (mobile):**
- Title animation: ~80px
- Metadata rows: ~60px
- Fun fact: ~50px
- Task frame: ~50px
- **Total overhead: ~240px before any evidence**
- Evidence cards: 4 rows × ~48px = ~192px
- Interaction hint + buttons: ~100px
- **Total: ~532px minimum**

On an iPhone 14 (844px tall - 91px status/nav - 44px header = **709px game viewport**), this barely fits and requires careful scrolling.

---

### 3. **Mobile Viewport Overflow**

**Root Causes:**

1. **Study phase** is the worst offender (see above)
2. **Solve phase** has less critical issues:
   - Query progress dots (5 × 44px = ~220px width) can wrap on small screens
   - Query flavor text (optional) adds 20-30px
   - Ghost tile hint caption shown early
   - Forfeit flow adds extra buttons mid-game

3. **No scroll containment strategy** — the game relies on `overflow-y-auto` on the phase containers but doesn't guarantee content fits in `h-svh`

---

## Recommended Fixes

### Fix 1: Progressive Disclosure in Study Phase

**Before** (current):
```
[Title animation]
[Region • Speakers • Badge]
[Fun fact paragraph]
[Task frame paragraph]
[Evidence card 1]
[Evidence card 2]
...
```

**After** (progressive):
```
[Title + badge inline]              ← Compact, one line
[Evidence card 1]                    ← Lead with data
[Evidence card 2]
...
[Evidence card 4]

[Collapsible "About this language" drawer]  ← Metadata behind disclosure
  → Region, speakers, family
  → Fun fact
  → Etymology, lineage

[Buttons: "Need a hint?" / "I'm ready"]
```

**Benefits:**
- Evidence cards visible immediately (no scroll on most phones)
- Language lore available but not blocking
- Faster time-to-interaction
- Fits 709px viewport easily

---

### Fix 2: Compact Study Phase Header

**Replace the verbose header with:**

```tsx
{/* Compact title + inline badge */}
<div className="flex items-center justify-between mb-6">
  <motion.h2 className="text-3xl font-display font-bold text-white">
    {puzzle.language}
  </motion.h2>
  <span className={`text-[10px] px-2 py-1 rounded-full border font-mono ${
    /endangered|critically|severely/i.test(puzzle.lore.endangerment)
      ? "border-red-400/30 text-red-300/60"
      : "border-emerald-400/30 text-emerald-300/60"
  }`}>
    {/endangered|critically|severely/i.test(puzzle.lore.endangerment) ? "endangered" : "living"}
  </span>
</div>

{/* Task frame only (one line) */}
<p className="text-[13px] italic text-white/60 text-center mb-5 max-w-md mx-auto">
  {puzzle.taskFrame}
</p>

{/* Evidence cards immediately follow */}
```

**Savings:** ~150px vertical space

---

### Fix 3: Collapsible Language Lore Drawer

Add a "ⓘ About {language}" disclosure triangle **below** the evidence cards (or in the header next to the title):

```tsx
<motion.details className="mt-4 text-[12px] text-white/60">
  <summary className="cursor-pointer hover:text-white/80 flex items-center gap-2">
    <span className="text-[10px]">▸</span>
    About {puzzle.language}
  </summary>
  <div className="mt-3 space-y-2 pl-4 border-l border-white/10">
    <p><strong>Region:</strong> {puzzle.region}</p>
    <p><strong>Speakers:</strong> {puzzle.lore.speakers}</p>
    <p><strong>Family:</strong> {puzzle.lore.family}</p>
    <p className="italic">{puzzle.lore.funFact}</p>
  </div>
</motion.details>
```

**Alternative:** Float the "ⓘ" icon in the top-right header next to the mute button, opens a modal/drawer.

---

### Fix 4: Solve Phase Viewport Guarantees

**Ensure content fits without scroll:**

1. **Query dots:** Horizontal scroll or carousel if > 5 queries
2. **Remove flavor text** or show it only on first query (tutorial)
3. **Ghost tile hint:** Show in toast instead of inline caption
4. **Forfeit button:** Only show after failed attempt, hide clear/check buttons when armed

**Target:** Entire solve phase fits in 709px on iPhone 14 without scrolling.

---

### Fix 5: Warmup Gate Simplification

**Current:** 3-column level picker (Gentle / Standard / Spicy) with blurbs takes ~120px.

**Alternative:** Single toggle or dropdown:
```
Practice mode: [Standard ▼]
```

Or move level selection to settings (archive panel) so the warmup is just:
```
[Warmup puzzle]
[Start button]
```

---

## Implementation Priority

| Fix | Impact | Effort | Priority |
|-----|--------|--------|----------|
| 1. Swahili badge bug | Critical (factual error) | Low | **P0** |
| 2. Study phase compact header | High (mobile UX) | Medium | **P1** |
| 3. Collapsible lore drawer | High (progressive disclosure) | Medium | **P1** |
| 4. Solve phase viewport fit | Medium (mobile quality) | High | **P2** |
| 5. Warmup simplification | Low (nice-to-have) | Low | **P3** |

---

## Specific Code Changes

### Change 1: Study Phase Compact Header

**File:** `showcase/app/play/study-phase.tsx`
**Lines 192-262** → Replace with compact version (see Fix 2 above)

### Change 2: Add Language Lore Disclosure

**File:** `showcase/app/play/study-phase.tsx`
**Insert after evidence cards** (line ~300, before pager dots)

### Change 3: Verify Swahili Badge Logic

**File:** `showcase/app/play/study-phase.tsx`
**Line 240-246** — Add debug logging or visual inspection to confirm the regex test is working correctly.

---

## Testing Checklist

- [ ] iPhone 14 (390×844): Study phase fits without scroll
- [ ] iPhone SE (375×667): Smallest target, must fit
- [ ] Swahili shows "living" badge (green), not "endangered"
- [ ] Speaker count for Swahili reads "80 million+ and growing"
- [ ] Collapsible lore drawer opens/closes smoothly
- [ ] Solve phase fits in viewport for all 5 queries (no scroll during play)
- [ ] Warmup gate fits in viewport

---

## Design Rationale

**Why progressive disclosure?**
- Users came to **play a deduction puzzle**, not read a linguistics essay
- Evidence cards are the core mechanic — they should be visible immediately
- Language lore is enrichment, not blocking content
- Mirrors successful puzzle UX (NYT games, Wordle): minimal chrome, instant action

**Why compact header?**
- Title + badge inline saves ~60px
- Task frame is enough orientation; fun fact can wait
- Mobile players don't scroll before starting — they want to see the whole game state at a glance

**Why keep some metadata?**
- The language context is part of the experience
- Showing "endangered" vs. "living" has educational value
- But it should be **available**, not **required** before play starts

---

## Notes

- The current design is **desktop-optimized** (lots of breathing room assumes vertical space)
- Mobile-first principle: **everything fits in the viewport, no scroll during active play**
- Progressive disclosure is standard UX for content-heavy interfaces (see: Wikipedia mobile, news apps)
- The "paragraphs below the title" complaint is valid — we're front-loading 240px of text before showing any game

---

## Next Steps

1. Fix Swahili badge (verify display logic)
2. Implement compact study phase header
3. Add collapsible lore drawer
4. User-test on iPhone 14 / SE
5. Iterate on solve phase layout if needed
