"use client";

// ─── GlyphDrift ───────────────────────────────────────────────────────────────
// Celebration layer: fragments of the language (its own morphemes) drift
// upward like embers off a fire. Deterministic pseudo-random placement keeps
// SSR/CSR markup identical. All motion via the .glyph-float keyframes, which
// the global prefers-reduced-motion block neutralises.

import { useMemo } from "react";

interface GlyphDriftProps {
  glyphs: string[];
  accent: string;
  count?: number;
}

const prand = (i: number, n: number): number => {
  const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const GlyphDrift = ({ glyphs, accent, count = 16 }: GlyphDriftProps) => {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        glyph: glyphs[i % glyphs.length],
        left: prand(i, 1) * 96,
        size: 15 + prand(i, 2) * 24,
        duration: 9 + prand(i, 3) * 9,
        delay: -prand(i, 4) * 18,
        peak: 0.1 + prand(i, 5) * 0.2,
        sway: `${(prand(i, 6) - 0.5) * 10}vw`,
        rot0: `${(prand(i, 7) - 0.5) * 16}deg`,
        rot1: `${(prand(i, 8) - 0.5) * 26}deg`,
        serif: prand(i, 9) > 0.35,
      })),
    [glyphs, count],
  );

  if (glyphs.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {items.map((it, i) => (
        <span
          key={i}
          className={`glyph-float absolute ${it.serif ? "font-display italic" : "font-mono"}`}
          style={{
            left: `${it.left}%`,
            bottom: "-7%",
            fontSize: it.size,
            color: accent,
            opacity: 0,
            ["--peak" as string]: it.peak,
            ["--sway" as string]: it.sway,
            ["--rot0" as string]: it.rot0,
            ["--rot1" as string]: it.rot1,
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
          }}
        >
          {it.glyph}
        </span>
      ))}
    </div>
  );
};
