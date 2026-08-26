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
    language: "Guazacapán Xinka",
    script: "piriyʼ · ɨmbirʼi · kʼaniyʼ",
    difficulty: 3,
    family: "Xinkan (isolate)",
    theme: { accent: "#f59e0b", sourceColor: "#fcd34d" },
    warmup: {
      pairs: [
        { source: "piriyʼ", target: "dog" },
        { source: "ɨmbirʼi", target: "water" },
        { source: "kʼaniyʼ", target: "house" },
      ],
      query: "What is 'piriyʼ kʼaniyʼ'?",
      answer: "dog house",
    },
  },

  theme: {
    accent: "#34d399",       // emerald — Amazonian green
    sourceColor: "#6ee7b7",  // emerald-300 — lighter for text readability
    bgTint: "#064e3b",       // emerald-950 — deep forest tint
  },
};

// ─── Puzzle pool (for future daily rotation) ────────────────────────────────

export const PUZZLE_POOL: Puzzle[] = [APURINA_PUZZLE];

// Daily puzzle selection (deterministic from date)
export function getTodaysPuzzle(): Puzzle {
  // MVP: only one puzzle. Future: rotate from pool using date seed.
  // const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  // return PUZZLE_POOL[daysSinceEpoch % PUZZLE_POOL.length];
  return APURINA_PUZZLE;
}

// Look up a specific puzzle by ID (for challenge links)
export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLE_POOL.find((p) => p.id === id);
}

// Generate a challenge URL for a specific puzzle
export function getChallengeUrl(puzzleId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://ratiocine.vercel.app";
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
