// Thin wrapper around Vercel Analytics custom events.
// No-ops locally / off-Vercel; never throws into the game loop.
import { track as vaTrack } from "@vercel/analytics";

export type RatiocineEvent =
  | "play_start"
  | "study_complete"
  | "evidence_open"
  | "context_reveal"
  | "first_submit"
  | "hint_used"
  | "query_reveal"
  | "puzzle_solved"
  | "shared"
  | "ai_verdict";

export function track(
  name: RatiocineEvent,
  props?: Record<string, string | number | boolean>,
): void {
  try {
    vaTrack(name, props);
  } catch {
    // analytics must never break gameplay
  }
}

// ============================================================================
// Research Data Collection (Phase 1)
// ============================================================================

export type SolverEventType =
  | "session_start"
  | "study_complete"
  | "tile_placed"
  | "tile_removed"
  | "submit"
  | "forfeit"
  | "ai_verdict";

export interface SessionStartData {
  puzzle_id: string;
  puzzle_date: string;
  viewport: { width: number; height: number };
  device_type: "mobile" | "tablet" | "desktop";
}

export interface StudyCompleteData {
  study_duration_ms: number;
  evidence_drawer_opens: number;
  gated_pairs_revealed: string[];
  evidence_interaction: Array<{
    row_id: string | number;
    dwell_time_ms: number;
    clicks: number;
  }>;
}

export interface TilePlacedData {
  query_index: number;
  position: number;
  tile_id: string;
  tile_text: string;
  elapsed_solve_ms: number;
  current_answer: string[];
}

export interface TileRemovedData {
  query_index: number;
  position: number;
  tile_id: string;
  elapsed_solve_ms: number;
  current_answer: string[];
}

export interface SubmitData {
  attempt_number: number;
  total_solve_time_ms: number;
  answers: string[][];
  grades: Array<{
    query_index: number;
    verdict: "correct" | "wrong" | "partial";
    em: number;
  }>;
  overall_verdict: "correct" | "partial" | "wrong";
  score: number;
}

export interface ForfeitData {
  query_index: number;
  attempt_number: number;
  revealed_answer: string[];
  user_answer: string[];
  total_attempts: number;
}

export interface AIVerdictData {
  modal_job_id: string;
  modal_solve_time_ms: number;
  ai_answers: string[][];
  ai_grades: Array<{
    query_index: number;
    verdict: "correct" | "wrong" | "partial";
    em: number;
  }>;
  ai_score: number;
  human_score: number;
  human_won: boolean;
}

export type SolverEventData =
  | SessionStartData
  | StudyCompleteData
  | TilePlacedData
  | TileRemovedData
  | SubmitData
  | ForfeitData
  | AIVerdictData;

/**
 * Track a solver event for research purposes.
 * Only logs if user has consented via localStorage flag.
 * Tracks aggregate metrics via Vercel Analytics + optionally sends full trace to /api/log-trace.
 */
export function trackSolverEvent(
  eventType: SolverEventType,
  data: SolverEventData,
): void {
  try {
    // Check consent
    const consent = localStorage.getItem("ration-research-consent");
    if (consent !== "true") return;

    // Track aggregate via Vercel Analytics (always, if consented)
    vaTrack(eventType, flattenForAnalytics(data));

    // Send full trace to logger (async, fire-and-forget)
    sendToTraceLogger(eventType, data);
  } catch {
    // Never break gameplay
  }
}

/**
 * Flatten nested data structures for Vercel Analytics (only accepts primitives).
 */
function flattenForAnalytics(
  data: SolverEventData,
): Record<string, string | number | boolean> {
  const flat: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      flat[key] = value;
    } else if (Array.isArray(value)) {
      flat[`${key}_count`] = value.length;
    } else if (value && typeof value === "object") {
      flat[`${key}_json`] = JSON.stringify(value);
    }
  }

  return flat;
}

/**
 * Send full trace to /api/log-trace (async, never throws).
 */
async function sendToTraceLogger(
  eventType: SolverEventType,
  data: SolverEventData,
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const trace = {
      event: eventType,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      ...data,
    };

    await fetch("/api/log-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trace),
    });
  } catch (err) {
    // Silent fail — logging must never break the game
    console.debug("Trace logging failed:", err);
  }
}

/**
 * Get or create a session ID (rotates per browser session, not persistent).
 */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server"; // SSR safety

  let sessionId = sessionStorage.getItem("ration-session-id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("ration-session-id", sessionId);
  }
  return sessionId;
}
