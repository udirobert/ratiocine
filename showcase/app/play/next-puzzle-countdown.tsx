"use client";

import { useEffect, useState } from "react";

// Same boundary as getTodaysPuzzle(): Math.floor(Date.now() / 86400000) — the
// daily puzzle rolls at UTC midnight.
const msUntilNextPuzzle = () =>
  (Math.floor(Date.now() / 86400000) + 1) * 86400000 - Date.now();

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = `${Math.floor(total / 3600)}`.padStart(2, "0");
  const m = `${Math.floor((total % 3600) / 60)}`.padStart(2, "0");
  const s = `${total % 60}`.padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const NextPuzzleCountdown = () => {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(msUntilNextPuzzle());
    const t = setInterval(() => setRemaining(msUntilNextPuzzle()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <p className="text-[11px] font-mono text-white/55">
      <span className="sr-only">Next puzzle in {remaining === null ? "…" : fmt(remaining)}</span>
      <span aria-hidden="true">next puzzle in {remaining === null ? "--:--:--" : fmt(remaining)}</span>
    </p>
  );
};
