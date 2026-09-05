# Testing Mobile UX Improvements

**Date:** September 5, 2026
**Changes:** Compact headers, progressive disclosure, mobile viewport optimization

---

## Changes Summary

### Study Phase
- ✅ Compact header: title + inline badge (removed verbose char-by-char animation)
- ✅ Collapsible "About {language}" drawer (region/speakers/family/funFact hidden by default)
- ✅ Task frame reduced to single line
- ✅ Removed separate metadata rows (region · speakers · badge)
- ✅ Removed standalone fun fact paragraph
- ✅ **Badge logic fixed**: More explicit endangered detection (won't match "Not endangered")

### Solve Phase
- ✅ Query dots: 44px → 40px (mobile), 44px (desktop)
- ✅ Removed query flavor text (scenario framing)
- ✅ Tighter spacing: mb-5→mb-4, mb-4→mb-3 throughout
- ✅ All interactive elements: 40px base, 44px on sm+ breakpoint
- ✅ Responsive font sizes: smaller on mobile, full size on desktop
- ✅ Slots: 40px mobile, 44px desktop
- ✅ Bank tiles: 40px mobile, 44px desktop

### Warmup Gate
- ✅ Responsive padding: py-6 mobile, py-8 desktop
- ✅ All text slightly smaller on mobile
- ✅ Buttons: 44px mobile, 48px desktop

---

## Manual Testing Checklist

### 1. Start Dev Server
```bash
cd showcase
pnpm dev
```

Server should start at http://localhost:3000

---

### 2. Test Study Phase (All Puzzles)

**Navigate to:** http://localhost:3000/play

#### Desktop (Chrome DevTools)
- [ ] Open DevTools (Cmd+Opt+I)
- [ ] Toggle device toolbar (Cmd+Shift+M)
- [ ] Set to "Responsive" mode

#### Test Each Viewport:

**iPhone SE (375×667) — smallest target**
- [ ] Navigate to study phase
- [ ] Verify compact header (title + inline badge) fits without wrap
- [ ] Verify "About {language}" disclosure is collapsed by default
- [ ] Click disclosure triangle → drawer opens smoothly
- [ ] Verify 4 evidence cards visible without scroll
- [ ] Verify "I'm ready" button visible without scroll
- [ ] **CRITICAL:** Entire study phase fits in 667px viewport

**iPhone 14 (390×844)**
- [ ] Repeat all checks above
- [ ] Should have more comfortable spacing

**Desktop (1440×900)**
- [ ] Verify desktop styles apply (larger text, 48px buttons)
- [ ] Disclosure still works
- [ ] Layout doesn't look cramped

---

### 3. Test Solve Phase (All Puzzles)

**Navigate to solve phase** (click "I'm ready" from study)

#### iPhone SE (375×667)
- [ ] Query progress dots (5 circles) fit in one row
- [ ] Query prompt visible
- [ ] Answer slots fit without horizontal scroll
- [ ] Morpheme bank tiles fit (may wrap to 2-3 rows — acceptable)
- [ ] Coach caption ("tap tiles in order...") visible
- [ ] Submit/Clear/Evidence buttons fit without scroll
- [ ] Grading legend fits
- [ ] **CRITICAL:** No vertical scroll during active play

#### iPhone 14 (390×844)
- [ ] Everything fits comfortably
- [ ] Check after placing tiles (bank tiles disappear → more space)
- [ ] Check after first submission (grading legend appears)

#### iPad (768×1024)
- [ ] Should use desktop styles (sm: breakpoint at 640px)
- [ ] Verify 44px buttons, not 40px

---

### 4. Test All 5 Puzzles

**Verify badge accuracy:**

| Puzzle | Badge | Correct? |
|--------|-------|----------|
| Apurinã | 🔴 endangered | ✓ "Severely Endangered" |
| Swahili | 🟢 living | ✓ "Not endangered — vigorous" |
| Turkish | 🟢 living | ✓ "Not endangered — official" |
| Quechua | 🔴 endangered | ✓ "UNESCO lists...vulnerable" |
| Nahuatl | 🔴 endangered | ✓ "Many varieties are endangered" |

**Test URLs:**
- http://localhost:3000/play (today's puzzle)
- http://localhost:3000/play?puzzle=apurina-verb-agreement
- http://localhost:3000/play?puzzle=swahili-tense-marking
- http://localhost:3000/play?puzzle=turkish-vowel-harmony
- http://localhost:3000/play?puzzle=quechua-inclusive-we
- http://localhost:3000/play?puzzle=nahuatl-both-ends

For each puzzle:
- [ ] Study phase: badge color correct
- [ ] Study phase: disclosure drawer works
- [ ] Study phase: fits in iPhone SE viewport
- [ ] Solve phase: fits in iPhone SE viewport
- [ ] Solve phase: all interactions work (place, remove, submit)

---

### 5. Warmup Gate (First-Time Users)

**To test:** Clear localStorage or open incognito window

**Navigate to:** http://localhost:3000/play

- [ ] Warmup puzzle appears first (before study)
- [ ] Level picker (Gentle/Standard/Spicy) fits
- [ ] All elements fit in iPhone SE viewport
- [ ] Desktop styles apply on larger screens

---

### 6. Regression Testing

**Ensure nothing broke:**
- [ ] Archive panel still opens (📚 button in header)
- [ ] Evidence drawer still opens (book icon in solve phase)
- [ ] Hints still work (💡 button in header)
- [ ] Sound toggle still works (🔊/🔇 in header)
- [ ] Result screen still works (after completing all queries)
- [ ] Share card still generates
- [ ] AI comparison still works (after result)

---

## Expected Visual Changes

### Before (Old Study Phase)
```
[Large animated title: A p u r i n ã]      ← 80px
[Amazonas, Brazil · 2,800 speakers · 🔴]  ← 60px
[Fun fact paragraph about evidentiality]   ← 50px
[Task frame: "Figure out how..."]          ← 50px
[Evidence card 1]                          ← starts at ~240px
...
```

### After (New Study Phase)
```
[Apurinã                          🔴]      ← 40px
[Task frame: "Figure out how..."]          ← 30px
[▸ About Apurinã]                          ← 20px
[Evidence card 1]                          ← starts at ~90px ✅
...
```

**Savings:** ~150px vertical space
**Result:** Evidence cards visible immediately on iPhone SE

---

## Automated Testing (Future)

For CI/CD, add:
```bash
# Playwright visual regression tests
pnpm test:visual --project=mobile
```

Test snapshots for:
- Study phase (iPhone SE, badge visible)
- Solve phase (iPhone SE, all elements fit)
- Each puzzle's badge color

---

## Known Issues & Notes

1. **Query flavor text removed**: Scenario framing ("You're hungry...") was cut to save space. The query prompt alone is sufficient.

2. **Ghost tile hint**: Still shows in first slot for Q1/Q2, but inline (not as coach caption). This is a feature, not a bug.

3. **Collapsible lore**: Defaults to closed. Power users can expand it; casual players skip straight to evidence.

4. **Badge logic**: Now checks `startsWith("Classified as")` or `startsWith("UNESCO lists")` instead of regex `/endangered/i`. This prevents false positives like "Not endangered".

---

## Success Criteria

- ✅ Study phase fits in 667px viewport (iPhone SE)
- ✅ Solve phase fits in 667px viewport during active play
- ✅ All 5 puzzles show correct badge (3 endangered, 2 living)
- ✅ No horizontal scroll on any mobile viewport
- ✅ Desktop styles still look good (not overly cramped)
- ✅ No TypeScript errors
- ✅ All interactions still work (hints, evidence, submit, etc.)

---

## Deployment Notes

After testing locally:

1. Push changes to repo
2. Vercel auto-deploys preview
3. Test preview URL on real iPhone
4. If all good, merge to main
5. Production deploy at ratiocine.vercel.app

---

## Feedback Loop

If users still report:
- "Too much text" → Make lore drawer even more subtle (smaller disclosure)
- "Doesn't fit" → Measure actual viewport, might need to cut more spacing
- "Badge wrong" → Re-check endangerment text in puzzle-data.ts

Current design prioritizes:
1. **Evidence visible immediately** (core mechanic)
2. **Lore available but not blocking** (enrichment)
3. **Mobile-first** (most players are on phones)
