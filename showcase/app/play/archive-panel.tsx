"use client";

import { motion, AnimatePresence } from "motion/react";

import { PUZZLE_POOL, type PuzzleProgress } from "./puzzle-data";

interface ArchivePanelProps {
  currentPuzzleId: string;
  progress: PuzzleProgress | null;
  onClose: () => void;
}

/**
 * Practice archive — every puzzle in the pool, playable any time.
 * Selection is marked so returning players can spot what they've cracked;
 * today's daily is flagged. Navigation reuses the `?puzzle=` challenge-link
 * routing so links remain shareable.
 */
export const ArchivePanel = ({ currentPuzzleId, progress, onClose }: ArchivePanelProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label="Puzzle archive"
  >
    <div
      className="archive-card relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Close archive"
      >
        ×
      </button>

      <h2 className="font-display text-lg font-bold text-white mb-1">Field archive</h2>
      <p className="text-[12px] text-white/50 mb-4">
        Every language in the rotation — practice any time.
      </p>

      <div className="space-y-2">
        {PUZZLE_POOL.map((p) => {
          const cracked = progress?.languagesCracked.includes(p.languageCode) ?? false;
          const isCurrent = p.id === currentPuzzleId;
          return (
            <a
              key={p.id}
              href={`/play?puzzle=${encodeURIComponent(p.id)}`}
              className="archive-card block rounded-xl border border-white/10 p-3.5 hover:border-white/25 transition-colors group"
              aria-label={`Play ${p.language} — ${p.title}${cracked ? " (solved)" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-display text-[15px] font-bold"
                      style={{ color: p.theme.accent }}
                    >
                      {p.language}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">{p.family}</span>
                    {cracked && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-white/15 text-white/60">
                        ✓ cracked
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full text-black" style={{ backgroundColor: p.theme.accent }}>
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-white/60 truncate mt-0.5">
                    {p.title} · {p.region}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full text-black transition-all group-hover:brightness-110"
                  style={{ backgroundColor: p.theme.accent }}
                >
                  Play →
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  </motion.div>
);
