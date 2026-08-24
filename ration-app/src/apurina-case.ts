export const APURINA_CASE_VERSION = "1";
export const APURINA_CASE_ID = "apurina-verb-agreement@1";
export const APURINA_CASE_HASH = "0a6a10d581455336bc69def81c0e8ff0e2d1c4938b4a7b796d5cac7c914bfac9"; // pragma: allowlist secret — public SHA-256 case identifier

export const APURINA_CASE = {
  id: APURINA_CASE_ID,
  label: "Apurinã · Compare your solve (graded)",
  task_type: "translation",
  context: [
    "Language: Apurinã",
    "Task: verb agreement",
    "",
    "Evidence:",
    "1. nhaapitaka = I am going",
    "2. ãpitaka = you (sg.) are going",
    "3. apitaka = he/she is going",
    "4. nhaakutaka = I am eating",
    "5. ãkutaka = you (sg.) are eating",
    "6. akutaka = he/she is eating",
    "7. nhaanykataka = I am speaking",
    "8. ãnykataka = you (sg.) are speaking",
    "9. anykataka = he/she is speaking",
    "10. kaapitaka = we (incl.) are going",
  ].join("\n"),
  query: [
    "Translate each English phrase into Apurinã.",
    "Return one unsegmented verb form per numbered item, in order.",
    "",
    "1. I am eating",
    "2. we (incl.) are eating",
    "3. you (sg.) are speaking",
    "4. we (incl.) are speaking",
    "5. he/she is going",
  ].join("\n"),
  ground_truth: ["nhaakutaka", "kaakutaka", "ãnykataka", "kaanykataka", "apitaka"],
} as const;

export type HumanOutcome = {
  answers: string[];
  attempts: number[];
  hintsUsed: number;
  elapsedSeconds: number;
  gatedContextRevealed: boolean;
};

type EncodedOutcome = {
  v: number;
  c: string;
  h: string;
  a: unknown[];
  t: unknown[];
  n: unknown;
  e: unknown;
  g: unknown;
};

const MAX_ELAPSED_SECONDS = 86_400;

function decodeBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

function boundedInt(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

/** Parses only the versioned, bounded browser declaration; the case itself is bundled. */
export function loadApurinaHandoff(): HumanOutcome | null {
  if (typeof window === "undefined") return null;
  const encoded = new URLSearchParams(window.location.search).get("handoff");
  if (!encoded || encoded.length > 1800) return null;
  const decoded = decodeBase64Url(encoded);
  if (!decoded) return null;
  try {
    const data = JSON.parse(decoded) as EncodedOutcome;
    if (data.v !== 1 || data.c !== APURINA_CASE_ID || data.h !== APURINA_CASE_HASH) return null;
    if (!Array.isArray(data.a) || !Array.isArray(data.t) || data.a.length !== 5 || data.t.length !== 5) return null;
    const answers = data.a.map((value) => typeof value === "string" && value.length <= 80 ? value : null);
    const attempts = data.t.map((value) => boundedInt(value, 99));
    const hintsUsed = boundedInt(data.n, 99);
    const elapsedSeconds = boundedInt(data.e, MAX_ELAPSED_SECONDS);
    if (answers.some((value) => value === null) || attempts.some((value) => value === null) || hintsUsed === null || elapsedSeconds === null || typeof data.g !== "boolean") return null;
    return { answers: answers as string[], attempts: attempts as number[], hintsUsed, elapsedSeconds, gatedContextRevealed: data.g };
  } catch {
    return null;
  }
}
