// Puzzle data module — Apurinã verb agreement
// Sourced from Linguini training set (IOL-style Rosetta Stone problem)

export interface PuzzlePair {
  id: number;
  source: string; // unfamiliar language
  target: string; // English gloss
  morphemes: string[]; // segmented morphemes of source
  gated?: boolean; // true = hidden initially, revealed by player action
}

export interface PuzzleQuery {
  id: number;
  prompt: string; // English to translate
  answer: string[]; // correct morpheme sequence
  answerJoined: string; // full correct answer string
  difficulty: "tutorial" | "standard" | "curveball";
  hintOnFail?: string;
  flavor?: string; // optional scenario framing e.g. "Your friend is going somewhere..."
}

export interface PuzzleHint {
  level: number;
  type: "highlight" | "reveal" | "rule";
  text: string;
  highlightRows?: number[]; // row IDs to highlight
  revealMorpheme?: { morpheme: string; meaning: string };
}

export interface LanguageLore {
  etymology: string; // origin of the language name
  geography: string; // where it's spoken
  speakers: string; // approximate speaker count + trend
  family: string; // language family context
  culturalNote: string; // something human and vivid
  endangerment: string; // UNESCO/Ethnologue status
  funFact: string; // memorable hook
  briefingHook: string; // one-sentence emotional hook for pre-solve
  lineageNote: string; // surprising connection to another language/culture
  coordinates: [number, number]; // lat, lng for map display
}

export interface PuzzlePreview {
  language: string;
  script: string; // sample characters
  difficulty: number; // 1-5
  family: string;
  theme: { accent: string; sourceColor: string; bgTint?: string };
  warmup?: {
    pairs: { source: string; target: string }[];
    query: string;
    answer: string;
    choices?: string[]; // multiple-choice options (answer included); derived if omitted
  };
}

// Derive 3 multiple-choice options for a warmup: the answer plus two
// plausible distractors drawn from the pair targets. Deterministic order so
// the answer isn't always first (answer lands in the middle).
export function warmupChoices(warmup: NonNullable<PuzzlePreview["warmup"]>): string[] {
  if (warmup.choices && warmup.choices.length >= 3) return warmup.choices.slice(0, 3);
  const distractors = warmup.pairs.map((p) => p.target).filter((t) => t !== warmup.answer);
  const picked = [warmup.answer, ...distractors].slice(0, 3);
  // Rotate so the answer sits in the middle: [d1, answer, d2]
  if (picked.length === 3) return [picked[1], picked[0], picked[2]];
  return picked;
}

// Build a warmup for TODAY's puzzle from its tutorial query (Q0): the first
// two evidence rows plus Q0's prompt, with distractors drawn from the other
// queries' answers. Learning transfers directly into the solve phase.
export function buildTodayWarmup(puzzle: Puzzle): NonNullable<PuzzlePreview["warmup"]> {
  const q0 = puzzle.queries[0];
  const pairs = puzzle.pairs.filter((p) => !p.gated).slice(0, 2).map((p) => ({
    source: p.source,
    target: p.target,
  }));
  const distractors = puzzle.queries
    .slice(1)
    .map((q) => q.answerJoined)
    .filter((a) => a !== q0.answerJoined)
    .slice(0, 2);
  const choices = [q0.answerJoined, ...distractors];
  const ordered = choices.length === 3 ? [choices[1], choices[0], choices[2]] : choices;
  return {
    pairs,
    query: `How do you say "${q0.prompt}"?`,
    answer: q0.answerJoined,
    choices: ordered,
  };
}

export interface PuzzleTheme {
  accent: string;       // primary accent color (hex) — buttons, highlights, progress
  sourceColor: string;  // tint for source language text in evidence cards
  bgTint: string;       // subtle radial gradient color for atmosphere
}

export interface Puzzle {
  id: string;
  language: string;
  languageCode: string;
  family: string;
  region: string;
  taskType: string;
  title: string;
  instruction: string;
  taskFrame: string; // one-line task framing for study phase e.g. "Figure out how this language builds its verbs."
  verdicts: { perfect: string; good: string; partial: string }; // warm human result messages
  pairs: PuzzlePair[];
  queries: PuzzleQuery[];
  morphemeBank: string[][]; // grouped tiles — each inner array is a visual group (e.g. prefixes, roots, suffixes)
  hints: PuzzleHint[];
  lore: LanguageLore;
  nextPreview: PuzzlePreview;
  theme: PuzzleTheme;
}

// ─── Apurinã Verb Agreement ────────────────────────────────────────────────

export const APURINA_PUZZLE: Puzzle = {
  id: "apurina-verb-agreement",
  language: "Apurinã",
  languageCode: "apu",
  family: "Arawakan",
  region: "Amazonas, Brazil",
  taskType: "translation",
  title: "Verb Agreement",
  instruction:
    "Study the Apurinã verb forms and their English translations. Deduce the morphological rules, then translate the English phrases by composing morpheme tiles.",
  taskFrame: "Figure out how Apurinã builds its verbs. Then prove it.",
  verdicts: {
    perfect: "You speak a little Apurinã now.",
    good: "Almost there — Apurinã is starting to click.",
    partial: "Tricky language. The rainforest keeps its secrets.",
  },

  pairs: [
    // Visible from start (rows 1-6): enough to notice person prefixes + roots
    { id: 1, source: "nhaapitaka", target: "I am going", morphemes: ["nhaa", "pita", "ka"] },
    { id: 2, source: "ãpitaka", target: "you are going", morphemes: ["ã", "pita", "ka"] },
    { id: 3, source: "apitaka", target: "he/she is going", morphemes: ["a", "pita", "ka"] },
    { id: 4, source: "nhaakutaka", target: "I am eating", morphemes: ["nhaa", "kuta", "ka"] },
    { id: 5, source: "ãkutaka", target: "you are eating", morphemes: ["ã", "kuta", "ka"] },
    { id: 6, source: "akutaka", target: "he/she is eating", morphemes: ["a", "kuta", "ka"] },
    // Gated (rows 7-10): require active reveal; row 10 is the crucial "we (everyone)" example
    { id: 7, source: "nhaanykataka", target: "I am speaking", morphemes: ["nhaa", "nykata", "ka"], gated: true },
    { id: 8, source: "ãnykataka", target: "you are speaking", morphemes: ["ã", "nykata", "ka"], gated: true },
    { id: 9, source: "anykataka", target: "he/she is speaking", morphemes: ["a", "nykata", "ka"], gated: true },
    { id: 10, source: "kaapitaka", target: "we (everyone) are going", morphemes: ["kaa", "pita", "ka"], gated: true },
  ],

  queries: [
    // Tutorial — easy win to teach the mechanic
    {
      id: 0,
      prompt: "I am eating",
      answer: ["nhaa", "kuta", "ka"],
      answerJoined: "nhaakutaka",
      difficulty: "tutorial" as const,
      hintOnFail: "Look at row 4 — it's the exact same phrase. This one is free!",
      flavor: "You're hungry after a long walk along the Purus River.",
    },
    // Standard
    {
      id: 1,
      prompt: "we (everyone) are eating",
      answer: ["kaa", "kuta", "ka"],
      answerJoined: "kaakutaka",
      difficulty: "standard",
      hintOnFail: "You need the 'we' prefix. Have you revealed all the context rows?",
      flavor: "Everyone sits down together for the meal.",
    },
    {
      id: 2,
      prompt: "you are speaking",
      answer: ["ã", "nykata", "ka"],
      answerJoined: "ãnykataka",
      difficulty: "standard",
      hintOnFail: "The 'speak' root only appears in the gated rows 7-9.",
      flavor: "Your companion is telling a story by the fire.",
    },
    {
      id: 3,
      prompt: "we (everyone) are speaking",
      answer: ["kaa", "nykata", "ka"],
      answerJoined: "kaanykataka",
      difficulty: "standard",
      hintOnFail: "Combine what you learned about 'we' with the 'speak' root.",
      flavor: "The whole village is having a conversation.",
    },
    // Synthesis — every needed morpheme and rule appears in the evidence.
    {
      id: 4,
      prompt: "he/she is going",
      answer: ["a", "pita", "ka"],
      answerJoined: "apitaka",
      difficulty: "standard",
      hintOnFail: "Compare rows 1–3: the person prefix changes while the 'go' root and ending stay the same.",
      flavor: "Someone is leaving for the next village.",
    },
  ],

  // Morpheme bank: grouped tiles (prefixes | roots | suffixes) + 1 distractor
  morphemeBank: [
    // Person prefixes
    ["nhaa", "ã", "a", "kaa"],
    // Verb roots
    ["pita", "kuta", "nykata"],
    // Suffix + distractor
    ["ka", "taka"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Compare rows 1-3: what stays the same, what changes? The changing part encodes person.",
      highlightRows: [1, 2, 3],
    },
    {
      level: 2,
      type: "reveal",
      text: "kaa- marks 'we (inclusive)'. It appears only in row 10 — you may need to reveal it.",
      revealMorpheme: { morpheme: "kaa", meaning: "we (incl.)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Structure: [person prefix] + [verb root] + [aspect suffix]. Roots: pita=go, kuta=eat, nykata=speak. The suffix -ka marks progressive ('am doing'). Every answer can be assembled from this evidence.",
    },
  ],

  lore: {
    etymology:
      "The name 'Apurinã' comes from the Apurinã people's self-designation. In their own language, they call themselves 'Popũkare' — the word 'Apurinã' was given by neighbouring groups and adopted by Portuguese colonists.",
    geography:
      "Spoken along the middle and upper Purus River in Amazonas state, Brazil — one of the Amazon's major southern tributaries. The Purus meanders through dense várzea floodplain forest, and Apurinã communities are scattered across a 600km stretch.",
    speakers:
      "Approximately 2,800–3,600 speakers remain (2023 estimates). The language is losing ground to Portuguese among younger generations in communities closer to urban centres like Lábrea and Tapauá.",
    family:
      "Arawakan — one of the largest language families in South America, stretching from the Caribbean (Taíno, Garifuna) through Central Amazonia. Apurinã is part of the Purus branch, relatively distant from the better-known Arawakan languages of the northern Amazon.",
    culturalNote:
      "The Apurinã are known for their intricate ritual knowledge tied to the xingané ceremony — a multi-day celebration involving elaborate body painting with genipapo dye, ritual combat, and the consumption of fermented drinks. The verb morphology you just decoded encodes tense, aspect, and person in a single word — a hallmark of polysynthetic Amazonian languages.",
    endangerment:
      "Classified as 'Severely Endangered' by UNESCO. Active documentation projects exist (notably by Sidney da Silva Facundes at UFPA), but intergenerational transmission is declining.",
    funFact:
      "Apurinã has a complex system of evidentiality — speakers grammatically mark whether they witnessed an event, heard about it, or inferred it. You can't say 'it rained' without revealing whether you saw the rain yourself.",
    briefingHook:
      "A language where you cannot describe an event without revealing how you know it happened.",
    lineageNote:
      "Related to Taíno — the first indigenous language Columbus encountered in the Caribbean. Same family, 4,000 km apart.",
    coordinates: [-6.73, -64.45],
  },

  nextPreview: {
    language: "Swahili",
    script: "ninapenda · utacheza",
    difficulty: 2,
    family: "Niger-Congo · Bantu",
    theme: {
      accent: "#f87171",
      sourceColor: "#fca5a5",
      bgTint: "#450a0a",
    },
    warmup: {
      pairs: [
        { source: "ninapenda", target: "I like" },
        { source: "anapenda", target: "he/she likes" },
      ],
      query: "What is 'unapenda'?",
      answer: "you like",
    },
  },

  theme: {
    accent: "#34d399",       // emerald — Amazonian green
    sourceColor: "#6ee7b7",  // emerald-300 — lighter for text readability
    bgTint: "#064e3b",       // emerald-950 — deep forest tint
  },
};

// ─── Swahili Person & Tense ──────────────────────────────────────────────────

export const SWAHILI_PUZZLE: Puzzle = {
  id: "swahili-person-tense",
  language: "Swahili",
  languageCode: "swa",
  family: "Niger-Congo · Bantu",
  region: "East Africa — Kenya, Tanzania, Uganda",
  taskType: "translation",
  title: "Person & Tense",
  instruction:
    "Study the Swahili verb forms and their English translations. Work out how the verb encodes who acts and when, then compose the translations from morpheme tiles.",
  taskFrame: "Swahili packs who and when into a single word. Unpack it.",
  verdicts: {
    perfect: "Hongera — you conjugate like a Nairobi local.",
    good: "Karibu — almost there. The prefixes are settling in.",
    partial: "Swahili rewards patience. The pattern is in there.",
  },

  pairs: [
    { id: 1, source: "ninapenda", target: "I like", morphemes: ["ni", "na", "penda"] },
    { id: 2, source: "unasoma", target: "you read", morphemes: ["u", "na", "soma"] },
    { id: 3, source: "anacheza", target: "she plays", morphemes: ["a", "na", "cheza"] },
    { id: 4, source: "nilipenda", target: "I liked", morphemes: ["ni", "li", "penda"] },
    { id: 5, source: "tulisoma", target: "we read (past)", morphemes: ["tu", "li", "soma"] },
    { id: 6, source: "utacheza", target: "you will play", morphemes: ["u", "ta", "cheza"] },
    { id: 7, source: "wataimba", target: "they will sing", morphemes: ["wa", "ta", "imba"] },
    { id: 8, source: "anaimba", target: "he sings", morphemes: ["a", "na", "imba"] },
  ],

  queries: [
    {
      id: 0,
      prompt: "I will like",
      answer: ["ni", "ta", "penda"],
      answerJoined: "nitapenda",
      difficulty: "tutorial" as const,
      hintOnFail: "Every piece is on the board: 'I' from rows 1 and 4, 'will' from rows 6 and 7, 'like' from rows 1 and 4.",
      flavor: "Tomorrow, you finally tell them.",
    },
    {
      id: 1,
      prompt: "they read",
      answer: ["wa", "na", "soma"],
      answerJoined: "wanasoma",
      difficulty: "standard",
      hintOnFail: "'They' appears only in row 7 — but there with 'will'. Borrow the prefix, swap the tense.",
      flavor: "The students open their books.",
    },
    {
      id: 2,
      prompt: "we sang",
      answer: ["tu", "li", "imba"],
      answerJoined: "tuliimba",
      difficulty: "curveball",
      hintOnFail: "'Sing' only shows up with 'they' and 'he'. It transfers — combine tu + past + imba.",
      flavor: "Last night, around the fire, everyone joined in.",
    },
  ],

  morphemeBank: [
    // Subject prefixes (m = 'you all' — the distractor)
    ["ni", "u", "a", "tu", "wa", "m"],
    // Tense markers
    ["na", "li", "ta"],
    // Verb roots
    ["penda", "soma", "cheza", "imba"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Compare rows 1 and 4 — same person, different time. The middle piece carries the tense.",
      highlightRows: [1, 4],
    },
    {
      level: 2,
      type: "reveal",
      text: "'ta' puts the action in the future.",
      revealMorpheme: { morpheme: "ta", meaning: "future (will…)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Structure: [who] + [when] + [verb]. ni=I, u=you, a=he/she, tu=we, wa=they · na=present, li=past, ta=future.",
    },
  ],

  lore: {
    etymology:
      "'Swahili' comes from Arabic sawāḥil, 'coasts' — the language grew up on the East African shore where Bantu speakers traded with Arab and Persian merchants.",
    geography:
      "East Africa: a national language in Tanzania and Kenya, with speakers across Uganda, Rwanda, Burundi, Mozambique and the DRC. Zanzibar's Stone Town is its historic heart.",
    speakers:
      "Over 80 million speakers, most using it as a second language — the most widely spoken language in Africa, and still growing.",
    family:
      "Niger-Congo, Bantu branch — the vast family covering most of sub-Saharan Africa. Swahili is Bantu grammar wearing centuries of Arabic, Persian, and Portuguese loanwords from the coastal trade.",
    culturalNote:
      "Swahili time starts at sunrise: 7 AM is 'saa moja', hour one of the day. The tense markers you just used (-na-, -li-, -ta-) sit inside the verb, so a single word carries a whole sentence.",
    endangerment:
      "Not endangered — vigorous and expanding. It's an official language of the African Union, and the UN marks World Kiswahili Language Day every July 7.",
    funFact:
      "'Hakuna matata' is real Swahili — 'there are no problems'. Simba (lion), rafiki (friend), and jambo (hello) all traveled the world through film.",
    briefingHook:
      "The language that gave the world 'hakuna matata' — where one word holds who, when, and what.",
    lineageNote:
      "Its verb machinery is cousin to Zulu and Xhosa; its dictionary carries a thousand years of monsoon trade with Arabia, Persia, and India.",
    coordinates: [-6.17, 39.19],
  },

  nextPreview: {
    language: "Turkish",
    script: "evler · atlar · çiçekler",
    difficulty: 2,
    family: "Turkic",
    theme: {
      accent: "#22d3ee",
      sourceColor: "#67e8f9",
      bgTint: "#083344",
    },
    warmup: {
      pairs: [
        { source: "ev", target: "house" },
        { source: "evler", target: "houses" },
        { source: "at", target: "horse" },
      ],
      query: "What is 'atlar'?",
      answer: "horses",
    },
  },

  theme: {
    accent: "#f87171",       // red-400 — Kenyan flag red
    sourceColor: "#fca5a5",  // red-300
    bgTint: "#450a0a",       // red-950
  },
};

// ─── Turkish Vowel Harmony ───────────────────────────────────────────────────

export const TURKISH_PUZZLE: Puzzle = {
  id: "turkish-vowel-harmony",
  language: "Turkish",
  languageCode: "tur",
  family: "Turkic",
  region: "Türkiye & the Eastern Mediterranean",
  taskType: "translation",
  title: "Vowel Harmony",
  instruction:
    "Study the Turkish nouns and their plurals. Find the rule that picks the plural ending, then compose the translations from morpheme tiles.",
  taskFrame: "One rule runs Turkish: vowels must agree. Find it, and every plural is yours.",
  verdicts: {
    perfect: "Mükemmel — the harmony is yours.",
    good: "Çok iyi — nearly singing in tune.",
    partial: "Turkish is a song; you caught a few notes.",
  },

  pairs: [
    { id: 1, source: "ev", target: "house", morphemes: ["ev"] },
    { id: 2, source: "at", target: "horse", morphemes: ["at"] },
    { id: 3, source: "kız", target: "girl", morphemes: ["kız"] },
    { id: 4, source: "göz", target: "eye", morphemes: ["göz"] },
    { id: 5, source: "gün", target: "day", morphemes: ["gün"] },
    { id: 6, source: "el", target: "hand", morphemes: ["el"] },
    { id: 7, source: "evler", target: "houses", morphemes: ["ev", "ler"] },
    { id: 8, source: "atlar", target: "horses", morphemes: ["at", "lar"] },
    { id: 9, source: "eller", target: "hands", morphemes: ["el", "ler"] },
    { id: 10, source: "kitaplar", target: "books", morphemes: ["kitap", "lar"] },
  ],

  queries: [
    {
      id: 0,
      prompt: "eyes",
      answer: ["göz", "ler"],
      answerJoined: "gözler",
      difficulty: "tutorial" as const,
      hintOnFail: "'Eye' is row 4. Its vowel is a front vowel, like in 'el' (row 9) — pick the matching ending.",
      flavor: "The watchtower keeps two of them on the horizon.",
    },
    {
      id: 1,
      prompt: "girls",
      answer: ["kız", "lar"],
      answerJoined: "kızlar",
      difficulty: "standard",
      hintOnFail: "The dotless ı is a back vowel — it behaves like the a in 'atlar'.",
      flavor: "The children race each other home from school.",
    },
    {
      id: 2,
      prompt: "days",
      answer: ["gün", "ler"],
      answerJoined: "günler",
      difficulty: "curveball",
      hintOnFail: "ü looks exotic but it's a front vowel — same family as the e in 'evler'.",
      flavor: "The harvest festival lasts a whole week.",
    },
  ],

  morphemeBank: [
    // Roots (kitap's plural is already in evidence; taş = stone is the distractor)
    ["ev", "at", "kız", "göz", "gün", "el", "kitap", "taş"],
    // Plural endings
    ["lar", "ler"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Say rows 7 and 8 out loud. Look only at the last vowel of each root.",
      highlightRows: [7, 8],
    },
    {
      level: 2,
      type: "reveal",
      text: "The plural ending has two costumes: -lar or -ler.",
      revealMorpheme: { morpheme: "ler", meaning: "plural (front vowels)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Vowel harmony: the ending copies the root's last vowel family. Back vowels (a, ı, o, u) → -lar. Front vowels (e, i, ö, ü) → -ler.",
    },
  ],

  lore: {
    etymology:
      "'Türk' may trace to an old root for 'strength' or 'ripeness'. The language renamed itself when the Republic did — since the 1930s it has called itself Türkçe.",
    geography:
      "Türkiye, Cyprus, and the Balkans, with large communities in Germany — and echoing cousins in a great arc across Central Asia.",
    speakers:
      "Around 80–90 million native speakers — by far the largest Turkic language.",
    family:
      "Turkic — close cousins with Azerbaijani and Turkmen, more distant with Uzbek, Kazakh, and Uyghur, stretching from the Mediterranean to Siberia.",
    culturalNote:
      "Vowel harmony is not just grammar, it's music: every suffix echoes the root's last vowel, so words 'sing in tune'. In 1928 the country swapped the Arabic script for Latin letters in a matter of months — one of history's fastest writing reforms.",
    endangerment:
      "Not endangered — the official language of Türkiye, with a thriving press, literature, and music scene.",
    funFact:
      "Turkish stacks endings into famously long words — 'muvaffakiyetsizleştiricileştiriveremeyebileceklerimizdenmişsinizcesine' means roughly 'as if you were one of those we could not easily turn into a maker of unsuccessful people.'",
    briefingHook:
      "A language where vowels must hold hands — and the whole grammar follows their lead.",
    lineageNote:
      "Its vowel harmony so charmed linguists that they once proposed a grand 'Altaic' family linking Turkish to Mongolian — maybe even Korean and Japanese.",
    coordinates: [39.93, 32.86],
  },

  nextPreview: {
    language: "Quechua",
    script: "rimani · mikhunki · purin",
    difficulty: 3,
    family: "Quechuan",
    theme: {
      accent: "#c084fc",
      sourceColor: "#d8b4fe",
      bgTint: "#2d1b4e",
    },
    warmup: {
      pairs: [
        { source: "rimani", target: "I speak" },
        { source: "rimanki", target: "you speak" },
      ],
      query: "What is 'riman'?",
      answer: "he/she speaks",
    },
  },

  theme: {
    accent: "#22d3ee",       // cyan-400 — Turkish turquoise
    sourceColor: "#67e8f9",  // cyan-300
    bgTint: "#083344",       // cyan-950
  },
};

// ─── Quechua Person Endings ──────────────────────────────────────────────────

export const QUECHUA_PUZZLE: Puzzle = {
  id: "quechua-person-endings",
  language: "Quechua",
  languageCode: "quz",
  family: "Quechuan",
  region: "The Andes — Peru, Bolivia, Ecuador",
  taskType: "translation",
  title: "Person Endings",
  instruction:
    "Study the Quechua verb forms and their English translations. Decode the person endings, then compose the translations from morpheme tiles.",
  taskFrame: "Quechua verbs wear their subject at the end. Decode the endings.",
  verdicts: {
    perfect: "Allillanchu — the endings obey you.",
    good: "Almost — the Andes are steep, but you're climbing.",
    partial: "Even the Inca road was built one stone at a time.",
  },

  pairs: [
    { id: 1, source: "rimani", target: "I speak", morphemes: ["rima", "ni"] },
    { id: 2, source: "rimanki", target: "you speak", morphemes: ["rima", "nki"] },
    { id: 3, source: "riman", target: "she speaks", morphemes: ["rima", "n"] },
    { id: 4, source: "rikuni", target: "I see", morphemes: ["riku", "ni"] },
    { id: 5, source: "mikhunki", target: "you eat", morphemes: ["mikhu", "nki"] },
    { id: 6, source: "purin", target: "he walks", morphemes: ["puri", "n"] },
    { id: 7, source: "rimanchik", target: "we (all of us) speak", morphemes: ["rima", "nchik"] },
    { id: 8, source: "mikhunchik", target: "we (all of us) eat", morphemes: ["mikhu", "nchik"] },
  ],

  queries: [
    {
      id: 0,
      prompt: "I walk",
      answer: ["puri", "ni"],
      answerJoined: "purini",
      difficulty: "tutorial" as const,
      hintOnFail: "Row 6 has 'walk'; rows 1 and 4 have 'I'. Snap them together.",
      flavor: "The trail over the pass begins before dawn.",
    },
    {
      id: 1,
      prompt: "we (all of us) see",
      answer: ["riku", "nchik"],
      answerJoined: "rikunchik",
      difficulty: "standard",
      hintOnFail: "'We' only appears in rows 7 and 8 — a long ending that includes the listener.",
      flavor: "From the summit, everyone looks out over the Sacred Valley.",
    },
    {
      id: 2,
      prompt: "she eats",
      answer: ["mikhu", "n"],
      answerJoined: "mikhun",
      difficulty: "curveball",
      hintOnFail: "Careful: 'she' and 'I' differ by a single vowel — compare rows 3 and 4.",
      flavor: "Lunch is quinoa soup — she's already at the table.",
    },
  ],

  morphemeBank: [
    // Verb roots (taki = sing is the distractor)
    ["rima", "riku", "mikhu", "puri", "taki"],
    // Person endings
    ["ni", "nki", "n", "nchik"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 1–3 share a root. Watch the ending change with the person.",
      highlightRows: [1, 2, 3],
    },
    {
      level: 2,
      type: "reveal",
      text: "'nchik' means we — including the person you're talking to.",
      revealMorpheme: { morpheme: "nchik", meaning: "we (inclusive)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Structure: [root] + [person]. ni=I, nki=you, n=he/she, nchik=we (incl.). Watch out: -n and -ni differ by one vowel.",
    },
  ],

  lore: {
    etymology:
      "Speakers call it Runasimi — 'the people's speech'. 'Quechua' may come from qheswa, the name for the temperate valleys where it spread.",
    geography:
      "The Andes of Peru, Bolivia, and Ecuador, spilling into Colombia, Argentina, and Chile — the spine of South America, from sea level to 5,000 metres.",
    speakers:
      "Roughly 7–8 million speakers — the most widely spoken indigenous language family of the Americas.",
    family:
      "Quechuan — really a family of related varieties rather than one language. The Cuzco variety in this puzzle descends from the administrative language of the Inca Empire.",
    culturalNote:
      "The Inca ran an empire of millions without writing, using knotted khipu cords — and this language. The inclusive 'we' you just used (-nchik) grammatically insists the listener belongs: a worldview baked into the verb.",
    endangerment:
      "UNESCO lists several Quechua varieties as vulnerable under Spanish pressure, but radio, music, and bilingual school programs are pushing back.",
    funFact:
      "You already speak some Quechua: llama, puma, condor, quinoa, coca, and jerky (from ch'arki) all hitchhiked into English from the Andes.",
    briefingHook:
      "The empire's language with no way to leave the listener out of 'we'.",
    lineageNote:
      "Its neighbour Aymara is famous among linguists for picturing the future as behind you — unseen — and the past as stretched out in front.",
    coordinates: [-13.53, -71.97],
  },

  nextPreview: {
    language: "Nahuatl",
    script: "nicochi · ticuica · cuicah",
    difficulty: 3,
    family: "Uto-Aztecan",
    theme: {
      accent: "#fbbf24",
      sourceColor: "#fcd34d",
      bgTint: "#3a1508",
    },
    warmup: {
      pairs: [
        { source: "nicochi", target: "I sleep" },
        { source: "ticochi", target: "you sleep" },
      ],
      query: "What is 'cochi'?",
      answer: "he/she sleeps",
    },
  },

  theme: {
    accent: "#c084fc",       // purple-400 — Andean woven textile
    sourceColor: "#d8b4fe",  // purple-300
    bgTint: "#2d1b4e",       // Andean dusk — woven-textile indigo (was purple-950, too near-black)
  },
};

// ─── Nahuatl Both Ends of the Verb ───────────────────────────────────────────

export const NAHUATL_PUZZLE: Puzzle = {
  id: "nahuatl-both-ends",
  language: "Nahuatl",
  languageCode: "nah",
  family: "Uto-Aztecan",
  region: "Central Mexico — Puebla, Guerrero, Veracruz",
  taskType: "translation",
  title: "Both Ends of the Verb",
  instruction:
    "Study the Classical Nahuatl verb forms and their English translations. The verb marks its subject at the front and 'many' at the back — then compose the translations from morpheme tiles.",
  taskFrame: "Nahuatl marks who at the front and how many at the back. Handle both ends.",
  verdicts: {
    perfect: "Qualli — both ends of the verb answer to you.",
    good: "So close — the Aztec scribes would nod.",
    partial: "The codices took years to read. You're faster.",
  },

  pairs: [
    { id: 1, source: "nicochi", target: "I sleep", morphemes: ["ni", "cochi"] },
    { id: 2, source: "ticochi", target: "you sleep", morphemes: ["ti", "cochi"] },
    { id: 3, source: "cochi", target: "he sleeps", morphemes: ["cochi"] },
    { id: 4, source: "nichoca", target: "I cry", morphemes: ["ni", "choca"] },
    { id: 5, source: "ticuica", target: "you sing", morphemes: ["ti", "cuica"] },
    { id: 6, source: "cuicah", target: "they sing", morphemes: ["cuica", "h"] },
    { id: 7, source: "nicochih", target: "we sleep", morphemes: ["ni", "cochi", "h"] },
  ],

  queries: [
    {
      id: 0,
      prompt: "I sing",
      answer: ["ni", "cuica"],
      answerJoined: "nicuica",
      difficulty: "tutorial" as const,
      hintOnFail: "Rows 1 and 4 start with 'I'; row 5 ends with 'sing'.",
      flavor: "The dawn ceremony needs your voice.",
    },
    {
      id: 1,
      prompt: "they cry",
      answer: ["choca", "h"],
      answerJoined: "chocah",
      difficulty: "standard",
      hintOnFail: "'They' needs no prefix — just the plural tail from row 6.",
      flavor: "The children miss their grandmother's stories.",
    },
    {
      id: 2,
      prompt: "we sing",
      answer: ["ni", "cuica", "h"],
      answerJoined: "nicuicah",
      difficulty: "curveball",
      hintOnFail: "'We' is both ends at once: the 'I' prefix plus the plural tail. Row 7 shows it with 'sleep'.",
      flavor: "The whole plaza sings together.",
    },
  ],

  morphemeBank: [
    // Subject prefixes (xi = command-form marker is the distractor)
    ["ni", "ti", "xi"],
    // Verb roots
    ["cochi", "choca", "cuica"],
    // Plural ending
    ["h"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 1 and 7 are both 'I sleep'… except one is plural. What got added, and where?",
      highlightRows: [1, 7],
    },
    {
      level: 2,
      type: "reveal",
      text: "A lone 'h' at the end makes the subject plural.",
      revealMorpheme: { morpheme: "h", meaning: "plural (more than one)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Structure: [who] + [verb] + (h if plural). ni=I/we, ti=you, nothing=he/she/they. 'We' = ni- plus -h: both ends at once.",
    },
  ],

  lore: {
    etymology:
      "'Nāhuatl' likely comes from a root meaning 'clear, audible speech' — the language that sounds like it means it.",
    geography:
      "Central Mexico: Puebla, Guerrero, Veracruz, Hidalgo, and the valleys around Mexico City — the old Aztec heartland.",
    speakers:
      "About 1.7 million speakers today — Mexico's largest indigenous language, though many local varieties are losing young speakers to Spanish.",
    family:
      "Uto-Aztecan — a family stretching from the US Great Basin (Shoshone, Ute, Comanche) down to El Salvador (Pipil). Hopi is a distant cousin.",
    culturalNote:
      "Classical Nahuatl was the language of Aztec law, astronomy, and poetry. Its poetry built meaning from paired metaphors: 'flower and song' meant poetry itself; 'water and mountain' meant a city.",
    endangerment:
      "Many varieties are endangered, but revitalization is real: Nahuatl hip-hop, TikTok teachers, and university chairs keep the language audible.",
    funFact:
      "You speak Nahuatl every day: chocolate (xocolātl), tomato (tomatl), avocado (āhuacatl), chili (chīlli), coyote (coyōtl), ocelot (ocēlōtl).",
    briefingHook:
      "The empire's language hiding in your kitchen: chocolate, tomato, avocado, coyote.",
    lineageNote:
      "Cousin to Hopi and Shoshone — its quiet plural -h is an echo of sound-changes that once swept half the American West.",
    coordinates: [19.43, -99.13],
  },

  nextPreview: {
    language: "Esperanto",
    script: "mi lernis · mi manĝos",
    difficulty: 2,
    family: "Constructed",
    theme: {
      accent: "#2dd4bf",
      sourceColor: "#5eead4",
      bgTint: "#042f2e",
    },
    warmup: {
      pairs: [
        { source: "mi lernas", target: "I learn" },
        { source: "mi lernis", target: "I learned" },
      ],
      query: "What is 'mi lernos'?",
      answer: "I will learn",
    },
  },

  theme: {
    accent: "#fbbf24",       // amber-400 — Aztec gold
    sourceColor: "#fcd34d",  // amber-300
    bgTint: "#3a1508",       // volcanic clay — warm earth, not pure black
  },
};

// ─── Puzzle pool (daily rotation) ───────────────────────────────────────────

export const ESPERANTO_PUZZLE: Puzzle = {
  id: "esperanto-tense",
  language: "Esperanto",
  languageCode: "epo",
  family: "Constructed · Romance/Germanic roots",
  region: "Worldwide (born in Warsaw)",
  taskType: "translation",
  title: "Tense Endings",
  instruction:
    "Study the Esperanto verb forms and their English translations. Deduce the tense system, then translate the English phrases by composing morpheme tiles.",
  taskFrame: "Figure out how Esperanto marks time. Then prove it.",
  verdicts: {
    perfect: "Bonege! You think like Zamenhof now.",
    good: "Almost fluent — the endings are clicking.",
    partial: "Tricky, but the pattern is perfectly regular. Look again.",
  },

  pairs: [
    { id: 1, source: "mi lernas", target: "I learn", morphemes: ["mi", "lern", "as"] },
    { id: 2, source: "mi lernis", target: "I learned", morphemes: ["mi", "lern", "is"] },
    { id: 3, source: "mi lernos", target: "I will learn", morphemes: ["mi", "lern", "os"] },
    { id: 4, source: "vi lernas", target: "you learn", morphemes: ["vi", "lern", "as"] },
    { id: 5, source: "li lernas", target: "he learns", morphemes: ["li", "lern", "as"] },
    { id: 6, source: "ni lernas", target: "we learn", morphemes: ["ni", "lern", "as"] },
    { id: 7, source: "mi manĝas", target: "I eat", morphemes: ["mi", "manĝ", "as"], gated: true },
    { id: 8, source: "ili lernas", target: "they learn", morphemes: ["ili", "lern", "as"], gated: true },
  ],

  queries: [
    {
      id: 0,
      prompt: "you learned",
      answer: ["vi", "lern", "is"],
      answerJoined: "vi lernis",
      difficulty: "tutorial",
      hintOnFail: "Take row 4 ('you learn') and swap the ending for the past one from row 2.",
      flavor: "Yesterday's lesson finally makes sense.",
    },
    {
      id: 1,
      prompt: "we learned",
      answer: ["ni", "lern", "is"],
      answerJoined: "ni lernis",
      difficulty: "standard",
      hintOnFail: "Start with 'we' from row 6, keep the root, use the past ending.",
    },
    {
      id: 2,
      prompt: "I will eat",
      answer: ["mi", "manĝ", "os"],
      answerJoined: "mi manĝos",
      difficulty: "standard",
      hintOnFail: "The 'eat' root only appears in gated row 7. The future ending is in row 3.",
      flavor: "Dinner plans, stated with confidence.",
    },
    {
      id: 3,
      prompt: "they eat",
      answer: ["ili", "manĝ", "as"],
      answerJoined: "ili manĝas",
      difficulty: "standard",
      hintOnFail: "Combine the 'they' pronoun from row 8 with the 'eat' root.",
    },
    {
      id: 4,
      prompt: "he ate",
      answer: ["li", "manĝ", "is"],
      answerJoined: "li manĝis",
      difficulty: "standard",
      hintOnFail: "li + manĝ + past ending. Every piece is in the evidence.",
    },
  ],

  morphemeBank: [
    ["mi", "vi", "li", "ni", "ili"],
    ["lern", "manĝ"],
    ["as", "is", "os"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 1-3 differ only at the end. The ending carries the tense.",
      highlightRows: [1, 2, 3],
    },
    {
      level: 2,
      type: "reveal",
      text: "-is marks the past. Every past form in the evidence ends in -is.",
      revealMorpheme: { morpheme: "is", meaning: "past tense" },
    },
    {
      level: 3,
      type: "rule",
      text: "Structure: [pronoun] + [root] + [tense]. -as = present, -is = past, -os = future. mi=I, vi=you, li=he, ni=we, ili=they.",
    },
  ],

  lore: {
    etymology: "'Esperanto' means 'one who hopes' — the pen name of L. L. Zamenhof, who published the language in Warsaw in 1887.",
    geography: "Spoken worldwide: congresses, clubs, and a native-speaking community of children raised in Esperanto households.",
    speakers: "Estimates range from 100,000 to 2 million; around 1,000 native speakers. Duolingo's Esperanto course has millions of learners.",
    family: "Constructed, with Romance and Germanic vocabulary and a Slavic-inspired structure. Designed for regularity: 16 rules, no exceptions.",
    culturalNote: "Esperanto was meant to be a neutral second language for peace. Its congresses still run entirely in Esperanto — a century-old experiment that never quite died.",
    endangerment: "Not endangered in the usual sense — but its native-speaker community is tiny and precious to linguists.",
    funFact: "Every Esperanto verb ending is fixed: -as is always present, -is always past, -os always future. No irregular verbs exist. At all.",
    briefingHook: "A language with zero irregular verbs. The puzzle practically solves itself — if you trust the pattern.",
    lineageNote: "Its vocabulary cousin is French and Latin; its idealism cousin is the internet itself.",
    coordinates: [52.23, 21.01],
  },

  nextPreview: {
    language: "Indonesian",
    script: "anak-anak · mereka makan",
    difficulty: 2,
    family: "Austronesian · Malayo-Polynesian",
    theme: { accent: "#f97316", sourceColor: "#fdba74", bgTint: "#431407" },
    warmup: {
      pairs: [
        { source: "anak", target: "child" },
        { source: "anak-anak", target: "children" },
      ],
      query: "What is 'kuda-kuda'?",
      answer: "horses",
    },
  },

  theme: {
    accent: "#2dd4bf",
    sourceColor: "#5eead4",
    bgTint: "#042f2e",
  },
};

// ─── Indonesian Reduplication ───────────────────────────────────────────────

export const INDONESIAN_PUZZLE: Puzzle = {
  id: "indonesian-plurals",
  language: "Indonesian",
  languageCode: "ind",
  family: "Austronesian · Malayo-Polynesian",
  region: "Indonesia (Jakarta)",
  taskType: "translation",
  title: "Plurals by Doubling",
  instruction:
    "Study the Indonesian words and their English translations. Deduce how plurals work, then translate the English phrases by composing tiles.",
  taskFrame: "Figure out how Indonesian makes things plural. Then prove it.",
  verdicts: {
    perfect: "Bagus sekali! You pluralize like a Jakartan.",
    good: "Almost there — the doubling trick is clicking.",
    partial: "The pattern is hiding in plain sight. Say the words out loud.",
  },

  pairs: [
    { id: 1, source: "anak", target: "child", morphemes: ["anak"] },
    { id: 2, source: "anak-anak", target: "children", morphemes: ["anak-anak"] },
    { id: 3, source: "kuda", target: "horse", morphemes: ["kuda"] },
    { id: 4, source: "kuda-kuda", target: "horses", morphemes: ["kuda-kuda"] },
    { id: 5, source: "saya makan", target: "I eat", morphemes: ["saya", "makan"] },
    { id: 6, source: "mereka makan", target: "they eat", morphemes: ["mereka", "makan"] },
    { id: 7, source: "buku", target: "book", morphemes: ["buku"], gated: true },
    { id: 8, source: "buku-buku", target: "books", morphemes: ["buku-buku"], gated: true },
    { id: 9, source: "kami makan", target: "we eat", morphemes: ["kami", "makan"], gated: true },
  ],

  queries: [
    {
      id: 0,
      prompt: "I eat",
      answer: ["saya", "makan"],
      answerJoined: "saya makan",
      difficulty: "tutorial",
      hintOnFail: "Row 5 is the exact same phrase. This one is free!",
    },
    {
      id: 1,
      prompt: "children",
      answer: ["anak-anak"],
      answerJoined: "anak-anak",
      difficulty: "standard",
      hintOnFail: "Compare rows 1-2: the plural just says the word twice.",
    },
    {
      id: 2,
      prompt: "horses",
      answer: ["kuda-kuda"],
      answerJoined: "kuda-kuda",
      difficulty: "standard",
      hintOnFail: "Same doubling trick as rows 2 and 4.",
    },
    {
      id: 3,
      prompt: "books",
      answer: ["buku-buku"],
      answerJoined: "buku-buku",
      difficulty: "standard",
      hintOnFail: "The 'book' root is in gated row 7 — reveal it, then double it.",
    },
    {
      id: 4,
      prompt: "we eat",
      answer: ["kami", "makan"],
      answerJoined: "kami makan",
      difficulty: "standard",
      hintOnFail: "'We' is kami from gated row 9. The verb never changes.",
      flavor: "The whole family sits down together.",
    },
  ],

  morphemeBank: [
    ["anak", "anak-anak", "kuda", "kuda-kuda", "buku", "buku-buku"],
    ["saya", "mereka", "kami", "makan"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 1-2 and 3-4: what happens to the word when the meaning becomes plural?",
      highlightRows: [1, 2, 3, 4],
    },
    {
      level: 2,
      type: "reveal",
      text: "Reduplication: saying the word twice makes it plural. anak-anak = children.",
      revealMorpheme: { morpheme: "anak-anak", meaning: "children (plural by doubling)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Plural = full reduplication (word-word). Verbs never change: saya=I, mereka=they, kami=we, makan=eat.",
    },
  ],

  lore: {
    etymology: "'Indonesia' means 'Indian islands' in Greek — a name adopted at independence in 1945.",
    geography: "The world's fourth most populous nation: 17,000 islands from Sumatra to Papua. Jakarta is the capital.",
    speakers: "Over 270 million people use Indonesian; ~43 million speak it natively. It is one of the fastest-growing languages on earth.",
    family: "Austronesian — the great seafaring family stretching from Madagascar to Easter Island. Malay is its closest kin.",
    culturalNote: "Indonesian was chosen at independence precisely because it belonged to no single ethnic group — a trade tongue promoted into a national language in one generation.",
    endangerment: "Thriving — though its success pressures hundreds of smaller regional languages like Javanese and Sundanese.",
    funFact: "Plurals by repetition: anak-anak (children), kuda-kuda (horses). In casual speech you can even drop the repetition if context is clear.",
    briefingHook: "A language where the plural is just saying the word twice.",
    lineageNote: "Cousin to Hawaiian, Māori, and Malagasy — one family that sailed half the planet.",
    coordinates: [-6.2, 106.8],
  },

  nextPreview: {
    language: "Finnish",
    script: "talot · kylässä",
    difficulty: 3,
    family: "Uralic · Finnic",
    theme: { accent: "#7dd3fc", sourceColor: "#bae6fd", bgTint: "#082f49" },
    warmup: {
      pairs: [
        { source: "talo", target: "house" },
        { source: "talot", target: "houses" },
      ],
      query: "What is 'kylät'?",
      answer: "villages",
    },
  },

  theme: {
    accent: "#f97316",
    sourceColor: "#fdba74",
    bgTint: "#431407",
  },
};

// ─── Finnish Vowel Harmony ──────────────────────────────────────────────────

export const FINNISH_PUZZLE: Puzzle = {
  id: "finnish-harmony",
  language: "Finnish",
  languageCode: "fin",
  family: "Uralic · Finnic",
  region: "Finland (Helsinki)",
  taskType: "translation",
  title: "Harmony Endings",
  instruction:
    "Study the Finnish words and their English translations. Deduce the plural and the 'in the…' endings — including which vowel goes with which word — then translate by composing tiles.",
  taskFrame: "Figure out how Finnish endings harmonize with their roots. Then prove it.",
  verdicts: {
    perfect: "Täydellistä! Even the vowels obey you.",
    good: "Almost — the harmony rule is starting to ring true.",
    partial: "Listen to the vowels. Front words want front endings.",
  },

  pairs: [
    { id: 1, source: "talo", target: "house", morphemes: ["talo"] },
    { id: 2, source: "talot", target: "houses", morphemes: ["talo", "t"] },
    { id: 3, source: "talossa", target: "in the house", morphemes: ["talo", "ssa"] },
    { id: 4, source: "kylä", target: "village", morphemes: ["kylä"] },
    { id: 5, source: "kylät", target: "villages", morphemes: ["kylä", "t"] },
    { id: 6, source: "kylässä", target: "in the village", morphemes: ["kylä", "ssä"] },
    { id: 7, source: "koulu", target: "school", morphemes: ["koulu"], gated: true },
    { id: 8, source: "koulut", target: "schools", morphemes: ["koulu", "t"], gated: true },
    { id: 9, source: "koulussa", target: "in the school", morphemes: ["koulu", "ssa"], gated: true },
  ],

  queries: [
    {
      id: 0,
      prompt: "houses",
      answer: ["talo", "t"],
      answerJoined: "talot",
      difficulty: "tutorial",
      hintOnFail: "Row 2 is the exact same word. This one is free!",
    },
    {
      id: 1,
      prompt: "in the house",
      answer: ["talo", "ssa"],
      answerJoined: "talossa",
      difficulty: "standard",
      hintOnFail: "Row 3 shows it: back-vowel roots take -ssa.",
    },
    {
      id: 2,
      prompt: "villages",
      answer: ["kylä", "t"],
      answerJoined: "kylät",
      difficulty: "standard",
      hintOnFail: "Plural -t works for every root. Row 5 proves it.",
    },
    {
      id: 3,
      prompt: "in the village",
      answer: ["kylä", "ssä"],
      answerJoined: "kylässä",
      difficulty: "curveball",
      hintOnFail: "kylä has front vowels (ä) — so it takes the front ending -ssä, not -ssa. Row 6.",
      flavor: "The front vowels demand their own ending.",
    },
    {
      id: 4,
      prompt: "in the school",
      answer: ["koulu", "ssa"],
      answerJoined: "koulussa",
      difficulty: "standard",
      hintOnFail: "koulu has back vowels (o, u) — back ending -ssa. Gated row 9 confirms it.",
    },
  ],

  morphemeBank: [
    ["talo", "kylä", "koulu"],
    ["t", "ssa", "ssä"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 3 and 6 both mean 'in the…' but the endings differ. What differs about the roots?",
      highlightRows: [3, 6],
    },
    {
      level: 2,
      type: "reveal",
      text: "-ssä is the front-vowel twin of -ssa. kylä (with ä) takes -ssä.",
      revealMorpheme: { morpheme: "ssä", meaning: "'in the…' (front-vowel form)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Plural is always -t. 'In the' is -ssa after back vowels (a, o, u) and -ssä after front vowels (ä, ö, y). The vowels must harmonize.",
    },
  ],

  lore: {
    etymology: "'Suomi' — the Finns' own name for their country — has no certain origin. Outsiders' 'Finland' likely comes from an old Germanic word for wanderers.",
    geography: "Finland: lakes, forests, and the Arctic north. Helsinki sits on the Gulf of Finland, a short ferry from Estonia.",
    speakers: "About 5.5 million speakers — nearly all in Finland, with communities in Sweden and Norway.",
    family: "Uralic — kin to Estonian and Hungarian, and famously unrelated to Swedish or Russian despite the neighbours.",
    culturalNote: "Finnish holds the world record for the longest palindromic word (saippuakivikauppias: travelling soapstone salesman) and compulsory vowel harmony that singers feel in their mouths.",
    endangerment: "Safe and thriving — though small dialects like Ingrian face extinction.",
    funFact: "Finnish vowels come in front and back teams that refuse to mix: talo takes -ssa, kylä demands -ssä. The mouth position must match.",
    briefingHook: "A language where the vowels vote — and the ending must obey the majority.",
    lineageNote: "Distant cousin to Hungarian — though a Finn and a Hungarian can't understand a word of each other's speech.",
    coordinates: [60.17, 24.94],
  },

  nextPreview: {
    language: "Māori",
    script: "māua · tātou",
    difficulty: 4,
    family: "Austronesian · Polynesian",
    theme: { accent: "#a3e635", sourceColor: "#d9f99d", bgTint: "#1a2e05" },
    warmup: {
      pairs: [
        { source: "māua", target: "we two, not you" },
        { source: "tāua", target: "you and I" },
      ],
      query: "What is 'mātou'?",
      answer: "we, not you",
    },
  },

  theme: {
    accent: "#7dd3fc",
    sourceColor: "#bae6fd",
    bgTint: "#082f49",
  },
};

// ─── Māori Pronouns ─────────────────────────────────────────────────────────

export const MAORI_PUZZLE: Puzzle = {
  id: "maori-pronouns",
  language: "Māori",
  languageCode: "mri",
  family: "Austronesian · Polynesian",
  region: "Aotearoa (Wellington)",
  taskType: "translation",
  title: "Who Is 'We'?",
  instruction:
    "Study the Māori pronouns and their English translations. Deduce how 'we' changes with who is included — then translate by composing tiles.",
  taskFrame: "Figure out how Māori draws the line around 'we'. Then prove it.",
  verdicts: {
    perfect: "Ka mau te wehi! You know exactly who 'we' is.",
    good: "Almost — the inclusive/exclusive line is getting clearer.",
    partial: "The secret is who counts as 'we'. Compare rows 4 and 5.",
  },

  pairs: [
    { id: 1, source: "au", target: "I", morphemes: ["au"] },
    { id: 2, source: "koe", target: "you", morphemes: ["koe"] },
    { id: 3, source: "ia", target: "he/she", morphemes: ["ia"] },
    { id: 4, source: "māua", target: "we two, not you", morphemes: ["mā", "ua"] },
    { id: 5, source: "tāua", target: "you and I", morphemes: ["tā", "ua"] },
    { id: 6, source: "mātou", target: "we, not you", morphemes: ["mā", "tou"] },
    { id: 7, source: "tātou", target: "all of us, incl. you", morphemes: ["tā", "tou"], gated: true },
    { id: 8, source: "rāua", target: "they two", morphemes: ["rā", "ua"], gated: true },
    { id: 9, source: "rātou", target: "they all", morphemes: ["rā", "tou"], gated: true },
  ],

  queries: [
    {
      id: 0,
      prompt: "we two, not you",
      answer: ["mā", "ua"],
      answerJoined: "māua",
      difficulty: "tutorial",
      hintOnFail: "Row 4 is the exact same word. This one is free!",
    },
    {
      id: 1,
      prompt: "all of us, incl. you",
      answer: ["tā", "tou"],
      answerJoined: "tātou",
      difficulty: "standard",
      hintOnFail: "tā- includes the listener (row 5), -tou means more than two (row 6). Gated row 7 confirms it.",
    },
    {
      id: 2,
      prompt: "they two",
      answer: ["rā", "ua"],
      answerJoined: "rāua",
      difficulty: "standard",
      hintOnFail: "rā- marks 'they' (gated rows 8-9), -ua marks exactly two (rows 4-5).",
    },
    {
      id: 3,
      prompt: "they all",
      answer: ["rā", "tou"],
      answerJoined: "rātou",
      difficulty: "standard",
      hintOnFail: "Combine rā- (they) with -tou (plural). Row 9.",
    },
    {
      id: 4,
      prompt: "we, not you",
      answer: ["mā", "tou"],
      answerJoined: "mātou",
      difficulty: "standard",
      hintOnFail: "mā- excludes the listener (row 4), -tou is plural. Row 6.",
      flavor: "Talking about your own group to an outsider.",
    },
  ],

  morphemeBank: [
    ["au", "koe", "ia"],
    ["mā", "tā", "rā"],
    ["ua", "tou"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 4 and 5 share an ending but mean different 'we's. The first half decides who is included.",
      highlightRows: [4, 5],
    },
    {
      level: 2,
      type: "reveal",
      text: "tā- includes the person you're talking to; mā- excludes them. -ua = two people, -tou = more.",
      revealMorpheme: { morpheme: "tā", meaning: "'we' including you" },
    },
    {
      level: 3,
      type: "rule",
      text: "[who] + [how many]: mā- = we-not-you, tā- = we-incl-you, rā- = they; -ua = two, -tou = three or more.",
    },
  ],

  lore: {
    etymology: "'Māori' means 'ordinary, normal' — the ordinary people, as opposed to spirits or strangers.",
    geography: "Aotearoa (New Zealand): from the subtropical north to the Southern Alps. Wellington is the capital.",
    speakers: "Around 200,000 speakers; an official language since 1987. Kōhanga reo (language nests) revived it from steep decline.",
    family: "Polynesian — close kin to Hawaiian, Samoan, and Tahitian. Its great voyages settled a triangle spanning a third of the globe.",
    culturalNote: "The haka, the hongi greeting, and whakapapa genealogies that recite dozens of generations — Māori draws identity from exactly who counts as 'us', which is what this puzzle is about.",
    endangerment: "Revitalizing: UNESCO lists it as vulnerable, but immersion schools and official status have reversed the decline.",
    funFact: "Māori has four kinds of 'we': you-and-I, us-two-not-you, all-of-us-incl-you, us-not-you. English makes do with one.",
    briefingHook: "A language with four different words for 'we' — because who is included matters.",
    lineageNote: "Sister to Hawaiian — the two split only ~800 years ago, when canoes carried Polynesians to Aotearoa.",
    coordinates: [-41.29, 174.78],
  },

  nextPreview: {
    language: "Zulu",
    script: "umntwana · abafana",
    difficulty: 3,
    family: "Niger-Congo · Bantu",
    theme: { accent: "#c084fc", sourceColor: "#d8b4fe", bgTint: "#2e1065" },
    warmup: {
      pairs: [
        { source: "umntwana", target: "child" },
        { source: "abantwana", target: "children" },
      ],
      query: "What is 'abafana'?",
      answer: "boys",
    },
  },

  theme: {
    accent: "#a3e635",
    sourceColor: "#d9f99d",
    bgTint: "#1a2e05",
  },
};

// ─── Zulu Noun Classes ──────────────────────────────────────────────────────

export const ZULU_PUZZLE: Puzzle = {
  id: "zulu-noun-class",
  language: "Zulu",
  languageCode: "zul",
  family: "Niger-Congo · Bantu",
  region: "South Africa (Durban)",
  taskType: "translation",
  title: "Noun Classes",
  instruction:
    "Study the Zulu nouns and their English translations. Deduce the singular/plural prefixes — then translate by composing tiles.",
  taskFrame: "Figure out how Zulu sorts its nouns into classes. Then prove it.",
  verdicts: {
    perfect: "Kuhle kakhulu! The classes bow to you.",
    good: "Almost — the class prefixes are falling into place.",
    partial: "Group the words by meaning, then watch the prefixes.",
  },

  pairs: [
    { id: 1, source: "umntwana", target: "child", morphemes: ["um", "ntwana"] },
    { id: 2, source: "abantwana", target: "children", morphemes: ["aba", "ntwana"] },
    { id: 3, source: "umfana", target: "boy", morphemes: ["um", "fana"] },
    { id: 4, source: "abafana", target: "boys", morphemes: ["aba", "fana"] },
    { id: 5, source: "isikolo", target: "school", morphemes: ["isi", "kolo"] },
    { id: 6, source: "izikolo", target: "schools", morphemes: ["izi", "kolo"] },
    { id: 7, source: "umfundi", target: "student", morphemes: ["um", "fundi"], gated: true },
    { id: 8, source: "abafundi", target: "students", morphemes: ["aba", "fundi"], gated: true },
  ],

  queries: [
    {
      id: 0,
      prompt: "boy",
      answer: ["um", "fana"],
      answerJoined: "umfana",
      difficulty: "tutorial",
      hintOnFail: "Row 3 is the exact same word. This one is free!",
    },
    {
      id: 1,
      prompt: "children",
      answer: ["aba", "ntwana"],
      answerJoined: "abantwana",
      difficulty: "standard",
      hintOnFail: "Take 'child' from row 1 and swap um- for the people-plural aba- from row 2.",
    },
    {
      id: 2,
      prompt: "school",
      answer: ["isi", "kolo"],
      answerJoined: "isikolo",
      difficulty: "standard",
      hintOnFail: "Things take isi- in the singular (row 5). People take um-.",
    },
    {
      id: 3,
      prompt: "schools",
      answer: ["izi", "kolo"],
      answerJoined: "izikolo",
      difficulty: "standard",
      hintOnFail: "Row 6: the thing-plural is izi-.",
    },
    {
      id: 4,
      prompt: "students",
      answer: ["aba", "fundi"],
      answerJoined: "abafundi",
      difficulty: "curveball",
      hintOnFail: "The 'student' root only appears in gated row 7. Students are people — people-plural aba-.",
      flavor: "Graduation day in KwaZulu-Natal.",
    },
  ],

  morphemeBank: [
    ["um", "aba", "isi", "izi"],
    ["ntwana", "fana", "kolo", "fundi"],
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Rows 1-4 are people, rows 5-6 are things. Do the prefixes care?",
      highlightRows: [1, 2, 5, 6],
    },
    {
      level: 2,
      type: "reveal",
      text: "aba- is the plural for people (class 2). izi- is the plural for things (class 8).",
      revealMorpheme: { morpheme: "aba", meaning: "plural of people" },
    },
    {
      level: 3,
      type: "rule",
      text: "People: um- (one) → aba- (many). Things: isi- (one) → izi- (many). Pick the prefix by class AND number.",
    },
  ],

  lore: {
    etymology: "'Zulu' comes from the legendary founder Zulu kaMalandela — the name means 'heaven' or 'sky'.",
    geography: "KwaZulu-Natal province, South Africa: Indian Ocean coast rising to the Drakensberg mountains. Durban is the great port city.",
    speakers: "Over 14 million speakers — South Africa's most-spoken home language, and an official language since 1994.",
    family: "Bantu — the giant subfamily that spread farming and iron across half of Africa. Xhosa and Swazi are its closest kin.",
    culturalNote: "Zulu is famous for its clicks (c, q, x) borrowed from Khoisan neighbours — and for a noun-class system where adjectives, verbs, and pronouns all agree with the noun's class.",
    endangerment: "Safe and growing — one of Africa's most vital languages.",
    funFact: "Zulu nouns come in classes like teams: people wear um-/aba-, things wear isi-/izi-. The prefix tells you what kind of thing you're talking about.",
    briefingHook: "A language where every noun wears its team's jersey — and the jersey changes in the plural.",
    lineageNote: "Close cousin to Swahili (already in your rotation) — same Bantu engine, different paint job. Compare their prefixes!",
    coordinates: [-29.86, 31.03],
  },

  nextPreview: {
    language: "Apurinã",
    script: "nhaapitaka · ãkutaka",
    difficulty: 4,
    family: "Arawakan",
    theme: { accent: "#34d399", sourceColor: "#6ee7b7", bgTint: "#064e3b" },
    warmup: {
      pairs: [
        { source: "nhaapitaka", target: "I am going" },
        { source: "ãpitaka", target: "you are going" },
      ],
      query: "What is 'apitaka'?",
      answer: "he/she is going",
    },
  },

  theme: {
    accent: "#c084fc",
    sourceColor: "#d8b4fe",
    bgTint: "#2e1065",
  },
};

// ─── Puzzle pool (daily rotation) ───────────────────────────────────────────

export const PUZZLE_POOL: Puzzle[] = [
  APURINA_PUZZLE,
  SWAHILI_PUZZLE,
  TURKISH_PUZZLE,
  QUECHUA_PUZZLE,
  NAHUATL_PUZZLE,
  ESPERANTO_PUZZLE,
  INDONESIAN_PUZZLE,
  FINNISH_PUZZLE,
  MAORI_PUZZLE,
  ZULU_PUZZLE,
];

// Daily puzzle selection (deterministic from date — same puzzle worldwide)
export function getTodaysPuzzle(): Puzzle {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return PUZZLE_POOL[daysSinceEpoch % PUZZLE_POOL.length];
}

// Look up a specific puzzle by ID (for challenge links)
export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLE_POOL.find((p) => p.id === id);
}

// Generate a challenge URL for a specific puzzle.
// Optional timeStr ("m:ss") embeds a ghost time for the friend to beat.
export function getChallengeUrl(puzzleId: string, timeStr?: string): string {
  // Canonical origin can be pinned at deploy time; otherwise use whatever
  // domain served the page so shares stay on-brand everywhere.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://ratiocine.vercel.app");
  const t = timeStr ? `&t=${encodeURIComponent(timeStr)}` : "";
  return `${base}/play?puzzle=${encodeURIComponent(puzzleId)}${t}`;
}

// ─── Grading ────────────────────────────────────────────────────────────────

export type TileGrade = "correct" | "misplaced" | "wrong";

export interface QueryGrade {
  queryId: number;
  grades: TileGrade[];
  isCorrect: boolean;
  attempt: number; // which attempt (1 or 2)
  revealed?: boolean; // true = player forfeited; counts as missed, share grid shows 🔍
}

export function gradeAnswer(
  query: PuzzleQuery,
  submitted: string[],
  attempt: number,
): QueryGrade {
  const grades: TileGrade[] = submitted.map((tile, i) => {
    if (i < query.answer.length && tile === query.answer[i]) return "correct";
    if (query.answer.includes(tile)) return "misplaced";
    return "wrong";
  });

  // Also check length mismatch
  const isCorrect =
    submitted.length === query.answer.length &&
    submitted.every((t, i) => t === query.answer[i]);

  return { queryId: query.id, grades, isCorrect, attempt };
}

// ─── Local storage helpers ──────────────────────────────────────────────────

const STORAGE_KEY = "ration-puzzle-progress";

// ─── Mid-solve draft (survive a refresh) ────────────────────────────────────

export interface SolveDraft {
  /** morpheme per slot, per query */
  answers: Array<Array<string | null>>;
  grades: Array<{ queryId: number; grades: TileGrade[]; isCorrect: boolean; attempt: number; revealed?: boolean }>;
  attempts: number[];
  locked: boolean[];
  score: number;
  elapsed: number;
  hintsUsed: number;
  revealedGated: boolean;
  contextReveals: number;
}

function draftKey(puzzleId: string): string {
  return `ration-solve-draft-${puzzleId}-${localDayKey()}`;
}

export function saveDraft(puzzleId: string, draft: SolveDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftKey(puzzleId), JSON.stringify(draft));
    // Prune yesterday's drafts for other puzzles
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ration-solve-draft-") && k !== draftKey(puzzleId) && !k.endsWith(localDayKey())) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

export function loadDraft(puzzleId: string): SolveDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(puzzleId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function clearDraft(puzzleId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(puzzleId));
  } catch {}
}

export interface PuzzleProgress {
  puzzlesSolved: number;
  lastSolvedDate: string | null; // YYYY-MM-DD (local calendar day)
  streak: number;
  bestTime: number | null; // seconds
  languagesCracked: string[]; // language codes
  history: string[]; // YYYY-MM-DD days solved (for streak repair / future calendar UI)
}

function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDayKey(d);
}

export function loadProgress(): PuzzleProgress {
  const empty: PuzzleProgress = { puzzlesSolved: 0, lastSolvedDate: null, streak: 0, bestTime: null, languagesCracked: [], history: [] };
  if (typeof window === "undefined") {
    return empty;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate pre-history saves
      if (!Array.isArray(parsed.history)) parsed.history = parsed.lastSolvedDate ? [parsed.lastSolvedDate] : [];
      return { ...empty, ...parsed };
    }
  } catch {}
  return empty;
}

export function saveProgress(progress: PuzzleProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function recordSolve(puzzle: Puzzle, elapsed: number): PuzzleProgress {
  const prev = loadProgress();
  const today = localDayKey();
  const yesterday = dayKeyOffset(-1);

  // Calendar-day streak logic (local days, idempotent replays same day)
  let streak = prev.streak;
  const alreadySolvedToday = prev.lastSolvedDate === today;
  if (alreadySolvedToday) {
    streak = Math.max(prev.streak, 1);
  } else if (prev.lastSolvedDate === yesterday) {
    streak = prev.streak + 1;
  } else {
    streak = 1;
  }

  const languagesCracked = prev.languagesCracked.includes(puzzle.languageCode)
    ? prev.languagesCracked
    : [...prev.languagesCracked, puzzle.languageCode];

  const history = alreadySolvedToday ? prev.history : [...prev.history, today];

  const progress: PuzzleProgress = {
    puzzlesSolved: alreadySolvedToday ? prev.puzzlesSolved : prev.puzzlesSolved + 1,
    lastSolvedDate: today,
    streak,
    bestTime: prev.bestTime === null ? elapsed : Math.min(prev.bestTime, elapsed),
    languagesCracked,
    history,
  };

  saveProgress(progress);
  return progress;
}
