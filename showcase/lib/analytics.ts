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
