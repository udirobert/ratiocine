// Puzzle data module — Apurinã verb agreement
// Sourced from Linguini training set (IOL-style Rosetta Stone problem)

export interface PuzzlePair {
  id: number;
  source: string; // unfamiliar language
  target: string; // English gloss
  morphemes: string[]; // segmented morphemes of source
}

export interface PuzzleQuery {
  id: number;
  prompt: string; // English to translate
  answer: string[]; // correct morpheme sequence
  answerJoined: string; // full correct answer string
}

export interface PuzzleHint {
  level: number;
  type: "highlight" | "reveal" | "rule";
  text: string;
  highlightRows?: number[]; // row IDs to highlight
  revealMorpheme?: { morpheme: string; meaning: string };
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
    "Study the Apurinã verb forms and their English translations. Then translate the English phrases into Apurinã by composing morpheme tiles.",

  pairs: [
    { id: 1, source: "nhaapitaka", target: "I am going", morphemes: ["nhaa", "pita", "ka"] },
    { id: 2, source: "ãpitaka", target: "you (sg.) are going", morphemes: ["ã", "pita", "ka"] },
    { id: 3, source: "apitaka", target: "he/she is going", morphemes: ["a", "pita", "ka"] },
    { id: 4, source: "nhaakutaka", target: "I am eating", morphemes: ["nhaa", "kuta", "ka"] },
    { id: 5, source: "ãkutaka", target: "you (sg.) are eating", morphemes: ["ã", "kuta", "ka"] },
    { id: 6, source: "akutaka", target: "he/she is eating", morphemes: ["a", "kuta", "ka"] },
    { id: 7, source: "nhaanykataka", target: "I am speaking", morphemes: ["nhaa", "nykata", "ka"] },
    { id: 8, source: "ãnykataka", target: "you (sg.) are speaking", morphemes: ["ã", "nykata", "ka"] },
    { id: 9, source: "anykataka", target: "he/she is speaking", morphemes: ["a", "nykata", "ka"] },
    { id: 10, source: "kaapitaka", target: "we (incl.) are going", morphemes: ["kaa", "pita", "ka"] },
  ],

  queries: [
    {
      id: 1,
      prompt: "we (incl.) are eating",
      answer: ["kaa", "kuta", "ka"],
      answerJoined: "kaakutaka",
    },
    {
      id: 2,
      prompt: "you (sg.) are speaking",
      answer: ["ã", "nykata", "ka"],
      answerJoined: "ãnykataka",
    },
    {
      id: 3,
      prompt: "we (incl.) are speaking",
      answer: ["kaa", "nykata", "ka"],
      answerJoined: "kaanykataka",
    },
  ],

  // All morphemes the player can use — correct ones + a few distractors
  morphemeBank: [
    "nhaa", "ã", "a", "kaa",   // person prefixes
    "pita", "kuta", "nykata",   // verb roots
    "ka",                       // progressive suffix
    // distractors (plausible but wrong)
    "ta", "na", "pi",
  ],

  hints: [
    {
      level: 1,
      type: "highlight",
      text: "Compare rows 1–3 with row 10. What changes between persons?",
      highlightRows: [1, 2, 3, 10],
    },
    {
      level: 2,
      type: "reveal",
      text: "The prefix kaa- marks 'we (inclusive)' — it appears in row 10.",
      revealMorpheme: { morpheme: "kaa", meaning: "we (incl.)" },
    },
    {
      level: 3,
      type: "rule",
      text: "Every form = [person prefix] + [verb root] + ka (progressive). Roots: pita = go, kuta = eat, nykata = speak.",
    },
  ],
};

// Daily puzzle selection (deterministic from date)
export function getTodaysPuzzle(): Puzzle {
  // MVP: only one puzzle. Future: rotate from pool using date seed.
  return APURINA_PUZZLE;
}

// Grading: exact match per query
export type TileGrade = "correct" | "misplaced" | "wrong";

export interface QueryGrade {
  queryId: number;
  grades: TileGrade[];
  isCorrect: boolean;
}

export function gradeAnswer(
  query: PuzzleQuery,
  submitted: string[],
): QueryGrade {
  const grades: TileGrade[] = submitted.map((tile, i) => {
    if (i < query.answer.length && tile === query.answer[i]) return "correct";
    if (query.answer.includes(tile)) return "misplaced";
    return "wrong";
  });

  const isCorrect =
    submitted.length === query.answer.length &&
    submitted.every((t, i) => t === query.answer[i]);

  return { queryId: query.id, grades, isCorrect };
}
