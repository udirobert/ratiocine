"use client";

import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { Puzzle, PuzzlePair, PuzzleTheme } from "./puzzle-data";

// Rows that share at least one morpheme with the tapped pair — the trace
// mechanic used identically in StudyPhase and the docked rail.
export function sharedRowsFor(pair: PuzzlePair, pairs: PuzzlePair[]): Set<number> {
  const shared = new Set<number>();
  for (const morpheme of pair.morphemes) {
    for (const other of pairs) {
      if (other.id !== pair.id && other.morphemes.includes(morpheme)) {
        shared.add(other.id);
      }
    }
  }
  return shared;
}

interface EvidenceCardProps {
  pair: PuzzlePair;
  highlighted: boolean;
  theme: PuzzleTheme;
  onSourceTap: () => void;
  instant?: boolean;
  pinned?: boolean;
  onPin?: () => void;
}

export const EvidenceCard = ({
  pair,
  highlighted,
  theme,
  onSourceTap,
  instant = false,
  pinned,
  onPin,
}: EvidenceCardProps) => (
  <motion.div
    initial={instant ? false : { opacity: 0, x: -12, scale: 0.97 }}
    animate={{
      opacity: 1,
      x: 0,
      scale: highlighted ? 1.01 : 1,
    }}
    transition={{ duration: instant ? 0.1 : 0.3, ease: "easeOut" }}
    className={`
      archive-card card-solid flex items-center gap-3 px-3 py-3 rounded-lg
      transition-all duration-300
      ${highlighted ? "pa-border-40" : ""}
      ${pinned ? "border-l-2 pa-border" : ""}
    `}
    style={{
      boxShadow: highlighted
        ? `0 0 16px ${theme.accent}25, 0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`
        : undefined,
      backgroundColor: highlighted ? `${theme.accent}0c` : undefined,
    }}
  >
    {/* Row number */}
    <span className="font-mono text-[11px] text-white/55 w-4 text-right shrink-0 tabular-nums">
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

    {onPin && (
      <button
        type="button"
        onClick={onPin}
        aria-pressed={pinned}
        aria-label={`Pin row ${pair.id}`}
        className={`shrink-0 -my-1 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
          pinned ? "pa-text" : "text-white/40 hover:text-white/80"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 17v5" />
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
        </svg>
      </button>
    )}
  </motion.div>
);

const MAX_PINS = 3;
const STRIP_COLLAPSED_ROWS = 2;

interface EvidenceRailProps {
  puzzle: Puzzle;
  highlightedRows: Set<number>;
  onTrace?: (pair: PuzzlePair) => void;
  variant: "dock" | "strip";
}

// Lean docked evidence list — the same rows StudyPhase teaches on, kept in
// view through the solve so reasoning replaces recall.
export const EvidenceRail = ({ puzzle, highlightedRows, onTrace, variant }: EvidenceRailProps) => {
  const { theme } = puzzle;
  const pairs = useMemo(() => puzzle.pairs.filter((p) => !p.gated), [puzzle.pairs]);
  const [pins, setPins] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [flashedRows, setFlashedRows] = useState<Set<number>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pinned rows float to the top in pin order; the rest keep data order.
  const sorted = useMemo(() => {
    const order = new Map(pairs.map((p, i) => [p.id, i]));
    return [...pairs].sort((a, b) => {
      const ai = pins.indexOf(a.id);
      const bi = pins.indexOf(b.id);
      const ak = ai === -1 ? pins.length + (order.get(a.id) ?? 0) : ai;
      const bk = bi === -1 ? pins.length + (order.get(b.id) ?? 0) : bi;
      return ak - bk;
    });
  }, [pairs, pins]);

  const togglePin = (id: number) => {
    setPins((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-MAX_PINS),
    );
  };

  const handleSourceTap = (pair: PuzzlePair) => {
    const shared = sharedRowsFor(pair, pairs);
    onTrace?.(pair);
    if (shared.size === 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashedRows(shared);
    flashTimerRef.current = setTimeout(() => setFlashedRows(new Set()), 1500);
  };

  const renderRow = (pair: PuzzlePair) => (
    <EvidenceCard
      key={pair.id}
      pair={pair}
      instant
      highlighted={highlightedRows.has(pair.id) || flashedRows.has(pair.id)}
      theme={theme}
      onSourceTap={() => handleSourceTap(pair)}
      pinned={pins.includes(pair.id)}
      onPin={() => togglePin(pair.id)}
    />
  );

  if (variant === "strip") {
    const visible = expanded ? sorted : sorted.slice(0, STRIP_COLLAPSED_ROWS);
    return (
      <div className="mb-3">
        <div className="space-y-1.5">
          {visible.map(renderRow)}
        </div>
        {sorted.length > STRIP_COLLAPSED_ROWS && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 w-full text-center font-mono text-[11px] text-white/70 hover:text-white transition-colors min-h-[36px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            {expanded ? "show fewer" : `+${sorted.length - STRIP_COLLAPSED_ROWS} more`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 rounded-xl border border-white/10 archive-card overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/55">
          Compare
        </span>
        <span className="font-mono text-[11px] text-white/55">
          {pairs.length} specimens
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5">
        {sorted.map(renderRow)}
      </div>
    </div>
  );
};
