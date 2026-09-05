"use client";

// Practice level — Duolingo-style generosity tuning. One variable, no puzzle
// forks: the level only changes how much help arrives and when, never the
// answers. Stored locally; Gentle is the mum-proof default for first-timers.

export type Level = "gentle" | "standard" | "spicy";

const LEVEL_KEY = "ration-practice-level";

export const LEVELS: Array<{ id: Level; label: string; blurb: string }> = [
  { id: "gentle", label: "Gentle", blurb: "Hints find you. No pressure." },
  { id: "standard", label: "Standard", blurb: "The daily puzzle as designed." },
  { id: "spicy", label: "Spicy", blurb: "Minimal help. Prove it." },
];

export function getLevel(): Level {
  if (typeof window === "undefined") return "standard";
  try {
    const v = window.localStorage.getItem(LEVEL_KEY);
    if (v === "gentle" || v === "standard" || v === "spicy") return v;
  } catch {}
  return "standard";
}

export function setLevel(level: Level): void {
  try {
    window.localStorage.setItem(LEVEL_KEY, level);
  } catch {}
}

/** Ghost hint: how long the first answer piece glows (ms, 0 = off). */
export function ghostMs(level: Level): number {
  return level === "gentle" ? 6000 : level === "standard" ? 2000 : 0;
}

/** Failed attempt count that surfaces the puzzle's fail hint. */
export function failHintAt(level: Level): number {
  return level === "gentle" ? 1 : 2;
}

/** Failed attempt count that arms the "reveal this one" forfeit. */
export function forfeitAt(level: Level): number {
  return level === "gentle" ? 1 : 2;
}

/** Gentle players get the level-1 hint played for them on first miss. */
export function autoHintOnFail(level: Level): boolean {
  return level === "gentle";
}
