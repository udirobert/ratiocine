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
  theme: { accent: string; sourceColor: string };
  warmup?: {
    pairs: { source: string; target: string }[];
    query: string;
    answer: string;
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
    theme: { accent: "#f87171", sourceColor: "#fca5a5" },
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
    theme: { accent: "#22d3ee", sourceColor: "#67e8f9" },
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
    theme: { accent: "#c084fc", sourceColor: "#d8b4fe" },
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
    theme: { accent: "#fbbf24", sourceColor: "#fcd34d" },
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
    bgTint: "#3b0764",       // purple-950
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
    language: "Apurinã",
    script: "nhaapitaka · ãkutaka",
    difficulty: 4,
    family: "Arawakan",
    theme: { accent: "#34d399", sourceColor: "#6ee7b7" },
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
    accent: "#fbbf24",       // amber-400 — Aztec gold
    sourceColor: "#fcd34d",  // amber-300
    bgTint: "#451a03",       // amber-950
  },
};

// ─── Puzzle pool (daily rotation) ───────────────────────────────────────────

export const PUZZLE_POOL: Puzzle[] = [
  APURINA_PUZZLE,
  SWAHILI_PUZZLE,
  TURKISH_PUZZLE,
  QUECHUA_PUZZLE,
  NAHUATL_PUZZLE,
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

// Generate a challenge URL for a specific puzzle
export function getChallengeUrl(puzzleId: string): string {
  // Canonical origin can be pinned at deploy time; otherwise use whatever
  // domain served the page so shares stay on-brand everywhere.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://ratiocine.vercel.app");
  return `${base}/play?puzzle=${encodeURIComponent(puzzleId)}`;
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

export interface PuzzleProgress {
  puzzlesSolved: number;
  lastSolvedDate: string | null;
  streak: number;
  bestTime: number | null; // seconds
  languagesCracked: string[]; // language codes
}

export function loadProgress(): PuzzleProgress {
  if (typeof window === "undefined") {
    return { puzzlesSolved: 0, lastSolvedDate: null, streak: 0, bestTime: null, languagesCracked: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { puzzlesSolved: 0, lastSolvedDate: null, streak: 0, bestTime: null, languagesCracked: [] };
}

export function saveProgress(progress: PuzzleProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function recordSolve(puzzle: Puzzle, elapsed: number): PuzzleProgress {
  const prev = loadProgress();
  const today = new Date().toISOString().slice(0, 10);

  // Streak logic
  let streak = prev.streak;
  if (prev.lastSolvedDate) {
    const lastDate = new Date(prev.lastSolvedDate);
    const diff = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
    } else if (diff > 1) {
      streak = 1;
    }
    // same day: don't increment streak
  } else {
    streak = 1;
  }

  const languagesCracked = prev.languagesCracked.includes(puzzle.languageCode)
    ? prev.languagesCracked
    : [...prev.languagesCracked, puzzle.languageCode];

  const progress: PuzzleProgress = {
    puzzlesSolved: prev.puzzlesSolved + 1,
    lastSolvedDate: today,
    streak,
    bestTime: prev.bestTime === null ? elapsed : Math.min(prev.bestTime, elapsed),
    languagesCracked,
  };

  saveProgress(progress);
  return progress;
}
