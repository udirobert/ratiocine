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
  difficulty: "standard" | "curveball"; // curveballs require deeper inference
  hintOnFail?: string; // shown after first failed attempt
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
  coordinates: [number, number]; // lat, lng for map display
}

export interface PuzzlePreview {
  language: string;
  script: string; // sample characters
  difficulty: number; // 1-5
  family: string;
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
  pairs: PuzzlePair[];
  queries: PuzzleQuery[];
  morphemeBank: string[]; // all available morphemes (includes distractors)
  hints: PuzzleHint[];
  lore: LanguageLore;
  nextPreview: PuzzlePreview; // teaser for the next puzzle
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

  pairs: [
    // Visible from start (rows 1-6): enough to notice person prefixes + roots
    { id: 1, source: "nhaapitaka", target: "I am going", morphemes: ["nhaa", "pita", "ka"] },
    { id: 2, source: "ãpitaka", target: "you (sg.) are going", morphemes: ["ã", "pita", "ka"] },
    { id: 3, source: "apitaka", target: "he/she is going", morphemes: ["a", "pita", "ka"] },
    { id: 4, source: "nhaakutaka", target: "I am eating", morphemes: ["nhaa", "kuta", "ka"] },
    { id: 5, source: "ãkutaka", target: "you (sg.) are eating", morphemes: ["ã", "kuta", "ka"] },
    { id: 6, source: "akutaka", target: "he/she is eating", morphemes: ["a", "kuta", "ka"] },
    // Gated (rows 7-10): require active reveal; row 10 is the crucial "we incl." example
    { id: 7, source: "nhaanykataka", target: "I am speaking", morphemes: ["nhaa", "nykata", "ka"], gated: true },
    { id: 8, source: "ãnykataka", target: "you (sg.) are speaking", morphemes: ["ã", "nykata", "ka"], gated: true },
    { id: 9, source: "anykataka", target: "he/she is speaking", morphemes: ["a", "nykata", "ka"], gated: true },
    { id: 10, source: "kaapitaka", target: "we (incl.) are going", morphemes: ["kaa", "pita", "ka"], gated: true },
  ],

  queries: [
    {
      id: 1,
      prompt: "we (incl.) are eating",
      answer: ["kaa", "kuta", "ka"],
      answerJoined: "kaakutaka",
      difficulty: "standard",
      hintOnFail: "You need the 'we (incl.)' prefix. Have you revealed all the context rows?",
    },
    {
      id: 2,
      prompt: "you (sg.) are speaking",
      answer: ["ã", "nykata", "ka"],
      answerJoined: "ãnykataka",
      difficulty: "standard",
      hintOnFail: "The 'speak' root only appears in the gated rows 7-9.",
    },
    {
      id: 3,
      prompt: "we (incl.) are speaking",
      answer: ["kaa", "nykata", "ka"],
      answerJoined: "kaanykataka",
      difficulty: "standard",
      hintOnFail: "Combine what you learned about 'we (incl.)' with the 'speak' root.",
    },
    {
      id: 4,
      prompt: "he/she is going (habitual)",
      answer: ["a", "pita", "na"],
      answerJoined: "apitana",
      difficulty: "curveball",
      hintOnFail: "All the context examples use -ka (progressive). What if the suffix changes for a different aspect?",
    },
  ],

  // Morpheme bank: correct tiles + plausible distractors that appear in context
  morphemeBank: [
    // Person prefixes (all appear in context)
    "nhaa", "ã", "a", "kaa",
    // Verb roots (all appear in context)
    "pita", "kuta", "nykata",
    // Suffixes
    "ka",   // progressive (in all context examples)
    "na",   // habitual (the curveball — not in context, must be inferred)
    // Hard distractors — these are sub-parts of real morphemes
    "nhaa·kuta", // someone might grab the whole prefix+root as one unit
    "taka",      // looks like it could be a suffix (it's root+suffix mashed)
    "api",       // sub-string of "apitaka" — tempting but wrong segmentation
    "kata",      // anagram of kuta+a
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
      text: "Structure: [person prefix] + [verb root] + [aspect suffix]. Roots: pita=go, kuta=eat, nykata=speak. The suffix -ka marks progressive ('am doing'). Question 4 asks about a different aspect.",
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
    coordinates: [-6.73, -64.45],
  },

  nextPreview: {
    language: "Guazacapán Xinka",
    script: "piriyʼ · ɨmbirʼi · kʼaniyʼ",
    difficulty: 3,
    family: "Xinkan (isolate)",
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

// ─── Grading ────────────────────────────────────────────────────────────────

export type TileGrade = "correct" | "misplaced" | "wrong";

export interface QueryGrade {
  queryId: number;
  grades: TileGrade[];
  isCorrect: boolean;
  attempt: number; // which attempt (1 or 2)
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
