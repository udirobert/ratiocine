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
  const [page, setPage] = useState(0);
  const [flashedRows, setFlashedRows] = useState<Set<number>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracedRef = useRef(false);
  const autoNudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default lore to OPEN on first visit to this puzzle, then remember state
  const [loreOpen, setLoreOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const key = `lore-seen-${puzzle.id}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      localStorage.setItem(key, "true");
      return true; // First visit: show lore
    }
    return false; // Return visit: collapsed
  });

  const { theme } = puzzle;
  const pairs = useMemo(() => puzzle.pairs.filter((p) => !p.gated), [puzzle.pairs]);

  // Helper to check if language is endangered (more explicit logic)
  const isEndangered = useMemo(() => {
    const text = puzzle.lore.endangerment.toLowerCase();
    return (
      text.startsWith("classified as") ||
      text.startsWith("unesco lists") ||
      text.startsWith("many varieties are endangered") ||
      /^(critically|severely|definitely|vulnerable)/.test(text)
    );
  }, [puzzle.lore.endangerment]);

  // Evidence pager — 4 specimens per page so the screen never scrolls.
  // The intro stagger plays on page one; dots guide the rest.
  const PAGE_SIZE = 4;
  const pageCount = Math.max(1, Math.ceil(pairs.length / PAGE_SIZE));
  const pagePairs = pairs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // After title animation settles, start showing rows (skipped in instant mode)
  useEffect(() => {
    if (instant) return;
    const titleDelay = 400; // Shortened from char-by-char animation
    const t = setTimeout(() => setShowRows(true), titleDelay);
    return () => clearTimeout(t);
  }, [instant]);

  // Stagger page-one rows in one by one (later pages render instantly)
  useEffect(() => {
    if (!showRows) return;
    const target = Math.min(PAGE_SIZE, pairs.length);
    if (visibleCount >= target) {
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

  // Jump to the page holding a highlighted row (hints, auto-nudge)
  useEffect(() => {
    if (highlightedRows.size === 0 && flashedRows.size === 0) return;
    const ids = [...highlightedRows, ...flashedRows];
    const idx = pairs.findIndex((p) => ids.includes(p.id));
    if (idx !== -1) setPage(Math.floor(idx / PAGE_SIZE));
  }, [highlightedRows, flashedRows, pairs]);

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
        <div className="m-auto w-full max-w-lg pt-6 pb-8">

          {/* Compact header: title + inline badge */}
          <motion.div
            initial={instant ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: instant ? 0 : 0.1, duration: 0.5 }}
            className="flex items-start justify-between gap-3 mb-3"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white">
              {puzzle.language}
            </h2>
            <span
              className={`shrink-0 text-[10px] px-2 py-1 rounded-full border font-mono ${
                isEndangered
                  ? "border-red-400/30 text-red-300/60"
                  : "border-emerald-400/30 text-emerald-300/60"
              }`}
            >
              {isEndangered ? "endangered" : "living"}
            </span>
          </motion.div>

          {/* Task frame — single line orientation */}
          <motion.p
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.2 }}
            className="text-[13px] sm:text-[14px] font-display italic text-white/60 text-center mb-5 leading-relaxed"
          >
            {puzzle.taskFrame}
          </motion.p>

          {/* Collapsible language lore drawer — defaults to OPEN on first visit */}
          <motion.details
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.25 }}
            className="mb-5 text-[13px] text-white/70"
            open={loreOpen}
            onToggle={(e) => setLoreOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer hover:text-white/90 flex items-center justify-center gap-2 transition-colors py-2 select-none">
              <span className="text-[10px] transition-transform" style={{ transform: loreOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                ▸
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-white/50 hover:text-white/70">
                About {puzzle.language}
              </span>
            </summary>
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-3 px-4 py-3.5 rounded-lg border border-white/10 bg-white/[0.03]"
            >
              <div>
                <span className="text-white/45 text-[10px] uppercase tracking-wide font-mono block mb-1">Region</span>
                <p className="text-white/85 leading-relaxed">{puzzle.region}</p>
              </div>
              <div>
                <span className="text-white/45 text-[10px] uppercase tracking-wide font-mono block mb-1">Speakers</span>
                <p className="text-white/85 leading-relaxed">{puzzle.lore.speakers}</p>
              </div>
              <div>
                <span className="text-white/45 text-[10px] uppercase tracking-wide font-mono block mb-1">Family</span>
                <p className="text-white/85 leading-relaxed">{puzzle.lore.family}</p>
              </div>
              <div className="pt-2.5 border-t border-white/10">
                <p className="text-white/80 italic leading-relaxed">{puzzle.lore.funFact}</p>
              </div>
            </motion.div>
          </motion.details>

          {/* Evidence specimens — one page of four, never a scroll */}
          <div className="space-y-1.5">
            {pagePairs.map((pair, i) => {
              const globalIdx = page * PAGE_SIZE + i;
              if (!instant && globalIdx >= visibleCount) return null;
              return (
                <EvidenceCard
                  key={pair.id}
                  pair={pair}
                  instant={instant}
                  highlighted={highlightedRows.has(pair.id) || flashedRows.has(pair.id)}
                  theme={theme}
                  onSourceTap={() => handleSourceTap(pair)}
                />
              );
            })}
          </div>

          {/* Pager dots — more specimens, no scrolling */}
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3" role="group" aria-label="Evidence pages">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/50 disabled:opacity-20 hover:text-white/80 transition-colors text-lg"
                aria-label="Previous evidence page"
              >
                ‹
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-all`}
                    aria-label={`Evidence page ${i + 1}`}
                    aria-current={i === page}
                  >
                    <span
                      className="w-2 h-2 rounded-full transition-colors"
                      style={{ backgroundColor: i === page ? theme.accent : "rgba(255,255,255,0.2)" }}
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page === pageCount - 1}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/50 disabled:opacity-20 hover:text-white/80 transition-colors text-lg"
                aria-label="Next evidence page"
              >
                ›
              </button>
            </div>
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
