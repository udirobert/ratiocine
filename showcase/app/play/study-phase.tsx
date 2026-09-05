"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Puzzle, PuzzlePair, PuzzleTheme } from "./puzzle-data";

interface StudyPhaseProps {
  puzzle: Puzzle;
  highlightedRows: Set<number>;
  onReady: () => void;
  /** Skip intro animations — used when returning to evidence mid-solve */
  instant?: boolean;
  /** Fires once, the first time the player traces a source word */
  onFirstTrace?: () => void;
}

export const StudyPhase = ({ puzzle, highlightedRows, onReady, instant = false, onFirstTrace }: StudyPhaseProps) => {
  const [showRows, setShowRows] = useState(instant);
  const [visibleCount, setVisibleCount] = useState(instant ? Number.MAX_SAFE_INTEGER : 0);
  const [ready, setReady] = useState(instant);
  const [flashedRows, setFlashedRows] = useState<Set<number>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracedRef = useRef(false);
  const autoNudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { theme } = puzzle;
  const pairs = puzzle.pairs.filter((p) => !p.gated);
  const chars = useMemo(() => puzzle.language.split(""), [puzzle.language]);

  // After title animation settles, start showing rows (skipped in instant mode)
  useEffect(() => {
    if (instant) return;
    const titleDelay = chars.length * 40 + 600;
    const t = setTimeout(() => setShowRows(true), titleDelay);
    return () => clearTimeout(t);
  }, [chars.length, instant]);

  // Stagger rows in one by one
  useEffect(() => {
    if (!showRows) return;
    if (visibleCount >= pairs.length) {
      setTimeout(() => setReady(true), 300);
      return;
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 80);
    return () => clearTimeout(t);
  }, [showRows, visibleCount, pairs.length]);

  const flashRows = (ids: Set<number>, ms = 1500) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashedRows(ids);
    flashTimerRef.current = setTimeout(() => setFlashedRows(new Set()), ms);
  };

  // Tap a source word → flash rows that share morphemes
  const handleSourceTap = (pair: PuzzlePair) => {
    const sharedRows = new Set<number>();
    for (const morpheme of pair.morphemes) {
      for (const other of pairs) {
        if (other.id !== pair.id && other.morphemes.includes(morpheme)) {
          sharedRows.add(other.id);
        }
      }
    }
    // First trace is a discovery moment, not just a control
    if (!tracedRef.current) {
      tracedRef.current = true;
      if (autoNudgeRef.current) clearTimeout(autoNudgeRef.current);
      onFirstTrace?.();
    }
    if (sharedRows.size === 0) return;
    flashRows(sharedRows);
  };

  // Hint button — flash the rows containing the most common morpheme
  const handleHint = () => {
    const counts = new Map<string, number>();
    for (const pair of pairs) {
      for (const morph of pair.morphemes) {
        counts.set(morph, (counts.get(morph) ?? 0) + 1);
      }
    }
    let best = "";
    let bestCount = 0;
    for (const [morph, c] of counts.entries()) {
      if (c > bestCount) {
        best = morph;
        bestCount = c;
      }
    }
    if (bestCount <= 1) return;
    const rows = new Set<number>();
    for (const pair of pairs) {
      if (pair.morphemes.includes(best)) rows.add(pair.id);
    }
    flashRows(rows);
  };

  // Auto-nudge: if the player hasn't traced anything ~3s after ready,
  // demonstrate it once on the most-shared morpheme. Cancelled by any tap.
  useEffect(() => {
    if (!ready || instant) return;
    autoNudgeRef.current = setTimeout(() => {
      if (tracedRef.current) return;
      const counts = new Map<string, number>();
      for (const pair of pairs) {
        for (const morph of pair.morphemes) {
          counts.set(morph, (counts.get(morph) ?? 0) + 1);
        }
      }
      let best = "";
      let bestCount = 0;
      for (const [morph, c] of counts.entries()) {
        if (c > bestCount) {
          best = morph;
          bestCount = c;
        }
      }
      if (bestCount <= 1) return;
      const rows = new Set<number>();
      for (const pair of pairs) {
        if (pair.morphemes.includes(best)) rows.add(pair.id);
      }
      flashRows(rows, 2200);
    }, 3000);
    return () => {
      if (autoNudgeRef.current) clearTimeout(autoNudgeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, instant]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">

      {/* Background tint — radial gradient from theme */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${theme.bgTint}15 0%, transparent 70%)`,
        }}
      />

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
        <div className="m-auto w-full max-w-lg pt-8 pb-8">

          {/* Language name — manuscript display, staggered characters */}
          <motion.h2
            className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-white text-center mb-2"
            initial={instant ? "visible" : "hidden"}
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
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.5 }}
            className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap mb-2 px-2 text-center"
          >
            <span className="text-[12px] text-white/50 font-mono">
              {puzzle.region}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[12px] text-white/50 font-mono">
              {puzzle.lore.speakers.split("—")[0].trim()}
            </span>
            {/endangered|critically|severely/i.test(puzzle.lore.endangerment) ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-red-400/30 text-red-300/60 font-mono">
                endangered
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300/60 font-mono">
                living
              </span>
            )}
          </motion.div>

          {/* Language hook — one-sentence "why this is cool" */}
          <motion.p
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.55 }}
            className="text-[12px] font-display italic text-center text-white/50 mb-8 max-w-sm mx-auto leading-relaxed"
          >
            {puzzle.lore.funFact}
          </motion.p>

          {/* Task framing — manuscript italic, like a field-notebook heading */}
          <motion.p
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.7 }}
            className="text-[15px] font-display italic text-white/65 text-center mb-6 max-w-xs mx-auto leading-relaxed"
          >
            {puzzle.taskFrame}
          </motion.p>

          {/* Evidence specimens */}
          <div className="space-y-1.5">
            {pairs.slice(0, visibleCount).map((pair) => (
              <EvidenceCard
                key={pair.id}
                pair={pair}
                instant={instant}
                highlighted={highlightedRows.has(pair.id) || flashedRows.has(pair.id)}
                theme={theme}
                onSourceTap={() => handleSourceTap(pair)}
              />
            ))}
          </div>

          {/* Lore hook — manuscript pull-quote, appears after a few rows */}
          {visibleCount > 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mt-6 text-[14px] font-display italic text-white/55 text-center leading-relaxed max-w-sm mx-auto"
            >
              &ldquo;{puzzle.lore.briefingHook}&rdquo;
            </motion.p>
          )}
        </div>
      </div>

      {/* Interaction hint + ready / hint buttons — in flow, so toasts can
          never cover the hint and the hint never covers evidence rows */}
      <motion.div
        className="shrink-0 flex flex-col items-center gap-2 px-4 pb-6 pt-2 z-20"
        initial={{ opacity: 0, y: 12 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-center text-[11px] text-white/40 font-mono">
          tap any source word to trace the pattern
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleHint}
            disabled={!ready}
            className="px-4 py-3 min-h-[48px] rounded-full text-sm font-medium text-white/80 transition-all disabled:opacity-0 hover:text-white hover:bg-white/10"
          >
            Need a hint?
          </button>
          <button
            onClick={onReady}
            disabled={!ready}
            className="pulse-glow px-7 py-3 min-h-[48px] rounded-full text-sm font-bold text-black transition-all disabled:opacity-0"
            style={{
              backgroundColor: theme.accent,
            }}
          >
            I&apos;m ready
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Evidence Card ────────────────────────────────────────────────────────────

const EvidenceCard = ({
  pair,
  highlighted,
  theme,
  onSourceTap,
  instant = false,
}: {
  pair: PuzzlePair;
  highlighted: boolean;
  theme: PuzzleTheme;
  onSourceTap: () => void;
  instant?: boolean;
}) => (
  <motion.div
    initial={instant ? false : { opacity: 0, x: -12, scale: 0.97 }}
    animate={{
      opacity: 1,
      x: 0,
      scale: highlighted ? 1.01 : 1,
    }}
    transition={{ duration: instant ? 0.1 : 0.3, ease: "easeOut" }}
    className={`
      archive-card card-solid flex items-center gap-3 px-4 py-3 rounded-lg
      transition-all duration-300
      ${highlighted ? "pa-border-40" : ""}
    `}
    style={{
      boxShadow: highlighted
        ? `0 0 16px ${theme.accent}25, 0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`
        : undefined,
      backgroundColor: highlighted ? `${theme.accent}0c` : undefined,
    }}
  >
    {/* Row number */}
    <span className="font-mono text-[10px] text-white/25 w-4 text-right shrink-0 tabular-nums">
      {pair.id}
    </span>

    {/* Source — tappable, themed color */}
    <button
      type="button"
      onClick={onSourceTap}
      className="font-mono text-[13px] flex-1 tracking-wide text-left cursor-pointer hover:underline underline-offset-2 decoration-white/20 transition-colors"
      style={{ color: `${theme.sourceColor}d9` }}
    >
      {pair.source}
    </button>

    {/* Connector */}
    <span className="text-white/15 text-[10px] shrink-0">→</span>

    {/* Gloss */}
    <span className="text-[12px] text-white/70 flex-1 text-right">
      {pair.target}
    </span>
  </motion.div>
);
