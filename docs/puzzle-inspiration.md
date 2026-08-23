# Puzzle Game — Inspiration from Unrelated Fields

Cross-pollinated ideas for making Ration's linguistics puzzles feel like discovery rather than homework. These draw from fields that have nothing to do with our competitors (Duolingo, Wordle, Langle) but everything to do with what makes people care about things they didn't know they cared about.

## 1. Cartography / Exploration (GeoGuessr, Atlas Obscura)

**Core insight:** People collect places. A solved puzzle becomes a *pin on a map*.

- Every puzzle is placed geographically (coordinates already in data)
- After solving, you "pin" the language on a world map
- Over time your collection becomes a visual atlas of languages you've decoded
- Cluster nearby languages to show family relationships spatially
- The map itself becomes the progression system — fill in regions, discover gaps
- "You've decoded 3 languages in the Amazon basin. 47 remain."

**Priority: HIGH** — simple SVG world map with accumulating dots is cheap to build and creates powerful collection drive.

## 2. Archaeology / Museum Curation (British Museum, Getty, field journals)

**Core insight:** Frame each puzzle as an *artefact discovery*, not a test.

- "You've found a fragment of Apurinã morphology" — language as archaeological dig
- Present context pairs as a field journal entry with hand-drawn-style borders
- The player is a "linguistic archaeologist" — each solve reconstructs a piece of human heritage
- Solved puzzles go into your personal "collection" — like a museum cabinet of curiosities
- Visual language: parchment textures, specimen labels, catalogue numbers
- "Specimen #042 — Verb agreement system, Apurinã, collected 23 Aug 2026"

**Priority: MEDIUM** — mostly tonal/framing changes; integrates with lore panel.

## 3. Board Games / Escape Rooms (Unlock!, Exit: The Game, The Witness)

**Core insight:** Resource management and discovery order create tension.

- Context pairs are "excavation sites" — you choose which to uncover first
- Limited reveals: you get 8 excavation tokens, but there are 10 possible rows
- The ORDER you discover rows changes your solving path (some orderings are harder)
- "Locked" rows tease with a blurred preview — you can see there's something there
- Multi-step puzzles: solving Q1 unlocks a new context row relevant to Q2
- Physical metaphor: cards you flip, rather than a table you read

**Priority: MEDIUM-HIGH** — the gated context is V1 of this; deepening the resource-management aspect is high-impact.

## 4. Music / Sound (Shazam, vinyl collecting, ASMR)

**Core insight:** Connect abstract symbols to living voices. The "identify this" dopamine.

- After solving, play a 5-second audio clip of the language being spoken
- The sound of a real speaker saying one of the forms you just decoded
- For endangered languages without recordings: ElevenLabs TTS to approximate (we have the power)
- The audio moment is when the puzzle stops being abstract and becomes *human*
- Optional: hear the word *before* you know what it means (audio-first variant puzzle type)
- Collect "sound samples" — your passport has audio attached to each pin

**Priority: HIGH** — a single audio clip per puzzle after solve is trivially implementable with the ElevenLabs power we already have installed. Maximum emotional impact per line of code.

## 5. Genealogy / DNA Testing (23andMe, Ancestry)

**Core insight:** People love discovering hidden connections and structure in their own history.

- "Your Language Passport" — shows which language *families* you've cracked
- Visual family tree of language relationships (Arawakan → Purus branch → Apurinã)
- "You've solved 3 Arawakan languages and 1 Austronesian. You're 2 away from unlocking the Indo-European branch."
- Collection drive without competition — it's personal progress, not a leaderboard
- Show surprising connections: "Did you know Garifuna (Caribbean) is related to Apurinã (Amazon)? Both are Arawakan."
- Unlock "family badges" when you complete all puzzles in a language family

**Priority: MEDIUM** — requires multiple puzzles per family to be meaningful; great for V2 when we have 20+ puzzles.

## 6. Wine / Coffee / Whisky Tasting (tasting notes, flavour wheels)

**Core insight:** Experts develop vocabulary for describing subtle differences. Give players that vocabulary.

- Each language has "tasting notes": structural features that characterise it
  - "Polysynthetic. Nasal vowel harmony. Suffix-heavy. Evidentiality marking."
  - "Isolating. Tonal (3 levels). Classifier system. Verb-final."
- After solving, you learn to *characterise* languages by their flavour
- Over time you develop genuine typological intuition
- "Flavour wheel" of linguistic features — your solved puzzles light up regions of it
- Eventually players start predicting: "This looks agglutinative — I bet the suffixes stack"

**Priority: LOW-MEDIUM** — beautiful concept but requires players to have solved 5+ puzzles before the vocabulary means anything. Good for retention in month 2+.

## 7. Birdwatching / Nature Identification (Merlin, iNaturalist)

**Core insight:** The joy of identification + life list + rarity scoring.

- "Rare" languages score higher (fewer than 1000 speakers = legendary rarity)
- "Life list" — how many language families have you encountered?
- Seasonal/regional "migrations" — feature languages from a region each month
- Community sightings: "247 players have cracked Apurinã this week"
- Rarity badges: "You solved a language with fewer than 100 speakers remaining"

**Priority: LOW** — fun but gamification-heavy; risk of trivialising endangered languages.

---

## Implementation Priority Stack

### Build now (this session)
1. **Language map** — SVG world map, pin after solve, accumulate over time
2. **Audio moment** — single TTS clip of a solved form, played on success reveal
3. **Artefact framing** — tone the UI toward "discovery/specimen" language

### Build next (V2)
4. **Deeper gating** — excavation tokens, order-dependent reveals
5. **Language passport** — family tree, relationship connections
6. **Tasting notes** — typological features shown after solve

### Build later (V3, needs puzzle pool)
7. **Family badges** — complete all puzzles in a language family
8. **Rarity system** — speaker-count-based scoring
9. **Flavour wheel** — typological intuition trainer
10. **Community stats** — how many people cracked this puzzle
