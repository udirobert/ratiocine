"use client";

// ─── Small decorative primitives ──────────────────────────────────────────────
// OrnamentRule — a hairline rule with a centered accent diamond, used to
// separate manuscript sections (title from evidence, score from share).
// Reads --puzzle-accent from the puzzle root.

export const OrnamentRule = ({ className = "" }: { className?: string }) => (
  <div aria-hidden="true" className={`flex items-center gap-2.5 ${className}`}>
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/18 to-white/25" />
    <span className="w-1 h-1 rotate-45 pa-bg-solid opacity-80" />
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/18 to-white/25" />
  </div>
);
