"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Puzzle, PuzzlePair } from "./puzzle-data";

interface StudyPhaseProps {
  puzzle: Puzzle;
  highlightedRows: Set<number>;
  onReady: () => void;
}

export const StudyPhase = ({ puzzle, highlightedRows, onReady }: StudyPhaseProps) => {
  const [showRows, setShowRows] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [ready, setReady] = useState(false);

  const pairs = puzzle.pairs.filter((p) => !p.gated);
  const chars = useMemo(() => puzzle.language.split(""), [puzzle.language]);

  // After title animation settles, start showing rows
  useEffect(() => {
    const titleDelay = chars.length * 40 + 600; // char stagger + pause
    const t = setTimeout(() => setShowRows(true), titleDelay);
    return () => clearTimeout(t);
  }, [chars.length]);

  // Stagger rows in one by one
  useEffect(() => {
    if (!showRows) return;
    if (visibleCount >= pairs.length) {
      // All rows visible — show ready button
      setTimeout(() => setReady(true), 300);
      return;
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 80);
    return () => clearTimeout(t);
  }, [showRows, visibleCount, pairs.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">

      {/* CRT scan lines atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)",
        }}
      />

      {/* Faint grain */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.02] grain-noise" />

      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 overflow-y-auto relative z-10">
        <div className="max-w-lg w-full pt-8 pb-24">

          {/* Language name — staggered characters, settles as header */}
          <motion.h2
            className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-center mb-2"
            initial="hidden"
            animate="visible"
          >
            {chars.map((char, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: i % 2 === 0 ? -20 : 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{
                  delay: 0.1 + i * 0.04,
                  duration: 0.4,
                  ease: [0.2, 0.65, 0.3, 0.9],
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.h2>

          {/* Region + speaker count */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            <span className="text-[12px] text-white/50 font-mono">
              {puzzle.region}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[12px] text-white/50 font-mono">
              ~2,800 speakers
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-red-400/30 text-red-300/60 font-mono">
              endangered
            </span>
          </motion.div>

          {/* Evidence specimens — stagger in like a researcher laying out cards */}
          <div className="space-y-1.5">
            {pairs.slice(0, visibleCount).map((pair, i) => (
              <EvidenceCard
                key={pair.id}
                pair={pair}
                index={i}
                highlighted={highlightedRows.has(pair.id)}
              />
            ))}
          </div>

          {/* Lore hook — appears after a few rows */}
          {visibleCount > 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mt-6 text-[13px] text-white/50 italic text-center leading-relaxed"
            >
              &ldquo;{puzzle.lore.briefingHook}&rdquo;
            </motion.p>
          )}
        </div>
      </div>

      {/* Ready button — fades in after all rows visible */}
      <motion.div
        className="absolute bottom-6 inset-x-0 flex justify-center z-20"
        initial={{ opacity: 0, y: 12 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={onReady}
          disabled={!ready}
          className="px-8 py-3 rounded-full bg-amber-500/90 text-sm font-bold text-black hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(229,168,75,0.15)] disabled:opacity-0"
        >
          I see it →
        </button>
      </motion.div>
    </div>
  );
};

// ─── Evidence Card ────────────────────────────────────────────────────────────

const EvidenceCard = ({
  pair,
  index,
  highlighted,
}: {
  pair: PuzzlePair;
  index: number;
  highlighted: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -12, scale: 0.97 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className={`
      flex items-center gap-3 px-4 py-3 rounded-lg
      border transition-colors
      ${highlighted
        ? "border-amber-400/30 bg-amber-400/[0.04] shadow-[0_0_12px_rgba(229,168,75,0.08)]"
        : "border-white/6 bg-white/[0.02]"
      }
    `}
    style={{
      boxShadow: highlighted ? undefined : "0 1px 3px rgba(0,0,0,0.3)",
    }}
  >
    {/* Row number */}
    <span className="font-mono text-[10px] text-white/25 w-4 text-right shrink-0 tabular-nums">
      {pair.id}
    </span>

    {/* Source — terminal green tint */}
    <span className="font-mono text-[13px] text-emerald-300/85 flex-1 tracking-wide">
      {pair.source}
    </span>

    {/* Connector */}
    <span className="text-white/15 text-[10px] shrink-0">→</span>

    {/* Gloss */}
    <span className="text-[12px] text-white/70 flex-1 text-right">
      {pair.target}
    </span>
  </motion.div>
);
