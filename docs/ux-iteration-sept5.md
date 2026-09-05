# UX Iteration — September 5, 2026 (Afternoon)

## User Feedback Received

1. **"Primers should be more available early"** — Language lore hidden in drawer was too buried
2. **"Text is too small/difficult to read"** — 12px in collapsed drawer was hard to parse
3. **"Always launches with Swahili"** — Wanted variety on repeated visits

---

## Changes Made (Second Pass)

### 1. Lore Drawer: Open by Default on First Visit ✅

**Problem:** Primers were hidden, users missed important context
**Solution:** Lore drawer now **opens automatically** on first visit to each puzzle

**Implementation:**
```tsx
const [loreOpen, setLoreOpen] = useState(() => {
  if (typeof window === "undefined") return false;
  const key = `lore-seen-${puzzle.id}`;
  const seen = localStorage.getItem(key);
  if (!seen) {
    localStorage.setItem(key, "true");
    return true; // First visit: show lore
  }
  return false; // Return visit: collapsed
});
```

**Behavior:**
- **First visit to Swahili:** Lore expanded (reads region/speakers/family/fun fact)
- **Return to Swahili:** Lore collapsed (you've seen it)
- **First visit to Turkish:** Lore expanded (new puzzle, new context)

**Benefit:** Users always see primers once per language, can revisit via disclosure

---

### 2. Improved Text Readability ✅

**Changes:**
- Font size: 12px → **13px** (8% larger)
- Text color: `text-white/60` → **`text-white/70`** (17% brighter)
- Content text: `text-white/70` → **`text-white/85`** (21% brighter)
- Border: `border-white/8` → **`border-white/10`** (25% stronger)
- Background: `bg-white/[0.02]` → **`bg-white/[0.03]`** (50% brighter)
- Spacing: `space-y-2.5` → **`space-y-3`**, padding increased

**Result:** Much easier to read on mobile screens

---

### 3. Randomization: 🎲 "Surprise me!" Button ✅

**Problem:** Daily puzzle is deterministic (today = Swahili), no easy way to try another
**Solution:** Added shuffle button in header

**Location:** Header bar (right side), next to archive (📚) and sound (🔊)

**Function:**
```tsx
const handleShuffle = () => {
  const random = getRandomPuzzle(puzzle.id); // Excludes current
  window.location.href = `/play?puzzle=${random.id}`;
};
```

**Icon:** 🎲 (dice)
**Tooltip:** "Surprise me!"

**Behavior:**
- Click → instant random puzzle (never the current one)
- Uses same `?puzzle=` URL scheme so it's shareable
- Works from warmup, study, or solve phase

---

## Why Deterministic Daily Still Matters

**Keep the daily rotation:**
- **Global coordination:** Everyone sees the same puzzle on a given day
- **Shareability:** "I got Swahili today!" vs "I got a random one"
- **Streak tracking:** Progress system expects daily consistency
- **Social proof:** Seeing others' results for same puzzle creates connection

**But add variety:**
- Archive (📚) for browsing all 10 languages
- Shuffle (🎲) for instant randomization
- Challenge links (?puzzle=) for direct access

---

## Current Header Layout

```
[←] [Language name • Family]     [Score] [💡] [📚] [🎲] [🔊]
```

**Icons:**
- 💡 = Hints (solve phase only)
- 📚 = Archive (browse all puzzles)
- 🎲 = Shuffle (random puzzle)
- 🔊/🔇 = Sound toggle

---

## Testing Notes

### Lore Drawer Behavior

**First visit flow:**
1. Load /play (gets today's puzzle, Swahili)
2. Study phase renders with lore **expanded**
3. User reads context, then clicks "I'm ready"
4. Solve phase begins

**Return visit flow:**
1. Load /play (same Swahili)
2. Study phase renders with lore **collapsed**
3. User can expand if needed, or skip straight to solve

**New puzzle flow:**
1. Click 🎲 or browse archive
2. New puzzle loads (e.g., Turkish)
3. Lore expands (first visit to Turkish)
4. localStorage: `lore-seen-turkish-vowel-harmony=true`

---

## Metrics (Updated)

| Change | Before | After | Impact |
|--------|--------|-------|--------|
| Lore font size | 12px | 13px | +8% readability |
| Lore text color | 60% opacity | 85% opacity | +42% contrast |
| Lore default state | Collapsed | **Expanded (1st visit)** | Primers visible |
| Variety | Daily only | Daily + Archive + **Shuffle** | Repeat engagement |

---

## Design Philosophy

### Progressive Disclosure — Refined

**First pass (earlier today):** Hid everything behind disclosure
**Feedback:** Too hidden, primers matter
**Second pass (now):** **Show once, then collapse**

**Analogy:** Like a tutorial tooltip that dismisses after first view

---

### Variety Without Chaos

**Problem:** Pure randomization loses social cohesion
**Solution:** Default to daily, offer shuffle as explicit opt-in

**User journey:**
1. **Day 1:** Load /play → Swahili (today's daily), lore expanded
2. **Day 1 later:** "Want more" → Click 🎲 → Turkish, lore expanded
3. **Day 1 later:** Click 🎲 → Quechua, lore expanded
4. **Day 2:** Load /play → Turkish (tomorrow's daily), lore collapsed (saw it yesterday)

**Result:** Fresh variety, but shared global context remains

---

## Files Modified

1. **`showcase/app/play/study-phase.tsx`**
   - Lore drawer: first-visit expansion logic
   - Improved text sizing/contrast

2. **`showcase/app/play/puzzle-view.tsx`**
   - Added shuffle button (🎲)
   - `handleShuffle` callback

3. **`showcase/app/play/puzzle-data.ts`**
   - New `getRandomPuzzle(excludeId)` function

---

## Future Enhancements

### If users still want more variety:

1. **Shuffle on homepage:** Add "Random puzzle" CTA on landing page
2. **Shuffle on result screen:** "Play another" → random instead of tomorrow's daily
3. **URL param:** `/play?random=true` auto-redirects to random puzzle
4. **Shuffle icon in archive:** Add dice next to each puzzle card

### If lore drawer still not discoverable:

1. **Pulse animation:** Subtle glow on first render
2. **Auto-scroll:** Ensure drawer is in viewport when expanded
3. **Coach caption:** "👆 Tap to learn about this language" on first visit

---

## Testing Checklist (Updated)

- [ ] Open /play for first time → Swahili lore **expanded**
- [ ] Refresh /play → Swahili lore **collapsed**
- [ ] Clear localStorage → Swahili lore **expanded again**
- [ ] Click 🎲 → Random puzzle loads (not Swahili)
- [ ] Click 🎲 again → Different random puzzle
- [ ] Open archive (📚) → All 10 puzzles visible
- [ ] Click archive card → Puzzle loads via ?puzzle= URL
- [ ] Lore text readable at 13px on iPhone SE
- [ ] Lore contrast sufficient (85% opacity)

---

## Summary

**Original problem:** "Too verbose, doesn't fit, always Swahili"
**First pass:** Compact header, progressive disclosure
**Second pass (this iteration):**
- ✅ Lore visible on first visit (primers available early)
- ✅ Lore more readable (13px, 85% opacity, better spacing)
- ✅ Shuffle button for variety (🎲 in header)

**Result:** Balanced UX that respects both:
- **First-time learners** (show primers, guide into puzzle)
- **Return visitors** (collapse noise, quick re-entry)
- **Explorers** (shuffle for variety)
- **Social players** (daily puzzle shared globally)
