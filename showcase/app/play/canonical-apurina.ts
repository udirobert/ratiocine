import { APURINA_PUZZLE } from "./puzzle-data";

/**
 * The cross-site contract for the Apurinã comparison. The complete case is
 * allowlisted on both sites; the URL carries only a browser-declared outcome.
 */
export const CANONICAL_APURINA_VERSION = 1;
export const CANONICAL_APURINA_CASE_ID = "apurina-verb-agreement@1";

const context = [
  "Language: Apurinã",
  "Task: verb agreement",
  "",
  "Evidence:",
  ...APURINA_PUZZLE.pairs.map((pair, index) => `${index + 1}. ${pair.source} = ${pair.target}`),
].join("\n");

const query = [
  "Translate each English phrase into Apurinã.",
  "Return one unsegmented verb form per numbered item, in order.",
  "",
  ...APURINA_PUZZLE.queries.map((item, index) => `${index + 1}. ${item.prompt}`),
].join("\n");

export const CANONICAL_APURINA_CASE = {
  version: CANONICAL_APURINA_VERSION,
  caseId: CANONICAL_APURINA_CASE_ID,
  language: APURINA_PUZZLE.language,
  taskType: APURINA_PUZZLE.taskType,
  context,
  query,
  expected: APURINA_PUZZLE.queries.map((item) => item.answerJoined),
} as const;

/** SHA-256 (hex) of JSON.stringify(CANONICAL_APURINA_CASE). */
export const CANONICAL_APURINA_CASE_HASH = "0a6a10d581455336bc69def81c0e8ff0e2d1c4938b4a7b796d5cac7c914bfac9"; // pragma: allowlist secret — public SHA-256 case identifier

export interface HumanOutcomeHandoff {
  v: typeof CANONICAL_APURINA_VERSION;
  c: typeof CANONICAL_APURINA_CASE_ID;
  h: typeof CANONICAL_APURINA_CASE_HASH;
  a: string[];
  t: number[];
  n: number;
  e: number;
  g: boolean;
}

const MAX_PAYLOAD_CHARS = 1800;
const MAX_ELAPSED_SECONDS = 86_400;

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Returns a bounded, unsigned URL declaration. It intentionally contains no
 * puzzle context or answer key: the receiving page only accepts its own
 * allowlisted canonical case after matching this version and hash.
 */
export function createApurinaComparisonUrl(input: {
  answers: Array<string | null | undefined>;
  attempts: number[];
  hintsUsed: number;
  elapsedSeconds: number;
  gatedContextRevealed: boolean;
}): string {
  const outcome: HumanOutcomeHandoff = {
    v: CANONICAL_APURINA_VERSION,
    c: CANONICAL_APURINA_CASE_ID,
    h: CANONICAL_APURINA_CASE_HASH,
    a: input.answers.map((answer) => String(answer ?? "").slice(0, 80)),
    t: input.attempts.map((attempt) => Math.max(0, Math.min(99, Math.floor(attempt)))),
    n: Math.max(0, Math.min(99, Math.floor(input.hintsUsed))),
    e: Math.max(0, Math.min(MAX_ELAPSED_SECONDS, Math.floor(input.elapsedSeconds))),
    g: Boolean(input.gatedContextRevealed),
  };
  const payload = encodeBase64Url(JSON.stringify(outcome));
  if (payload.length > MAX_PAYLOAD_CHARS) throw new Error("Comparison handoff is too large.");
  const base = process.env.NEXT_PUBLIC_RATION_TILE_URL || "https://ratiocine.trustfall.xyz/demo/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}handoff=${encodeURIComponent(payload)}`;
}
