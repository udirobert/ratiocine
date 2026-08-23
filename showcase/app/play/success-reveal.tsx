"use client";

import { motion } from "motion/react";
import type { Puzzle, PuzzleProgress } from "./puzzle-data";

interface SuccessRevealProps {
  puzzle: Puzzle;
  elapsed: number;
  hintsUsed: number;
  contextReveals: number;
  progress: PuzzleProgress | null;
}

export const SuccessReveal = ({
  puzzle,
  elapsed,
  hintsUsed,
  contextReveals,
  progress,
}: SuccessRevealProps) => {
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.03] px-6 py-6 text-center overflow-hidden"
    >
      {/* Cascade: each answer assembles */}
      <div className="space-y-3 mb-5">
        {puzzle.queries.map((query, i) => (
          <motion.div
            key={query.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.3, duration: 0.4 }}
            className="flex items-center justify-center gap-2"
          >
            <span className="text-[11px] text-white/30 font-mono w-6 text-right">
              Q{query.id}
            </span>

            {/* Morpheme tiles cascade into assembled word */}
            <div className="flex items-center gap-0.5">
              {query.answer.map((morph, mi) => (
                <motion.span
                  key={mi}
                  initial={{ opacity: 0, scale: 0.7, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: 0.4 + i * 0.3 + mi * 0.1,
                    duration: 0.25,
                    type: "spring",
                    stiffness: 300,
                  }}
                  className="px-1.5 py-0.5 rounded bg-emerald-400/15 font-mono text-sm text-emerald-300 border border-emerald-400/20"
                >
                  {morph}
                </motion.span>
              ))}
            </div>

            {/* Arrow → assembled word */}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 + i * 0.3 }}
              className="text-white/20 text-xs"
            >
              →
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.3, type: "spring", stiffness: 200 }}
              className="font-mono text-sm font-bold text-emerald-400"
            >
              {query.answerJoined}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* Victory text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <p className="text-lg font-bold text-emerald-400">
          You cracked {puzzle.language}.
        </p>
        <p className="text-sm text-white/50 mt-1">
          {timeStr}
          {hintsUsed > 0 && ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}`}
          {contextReveals > 0 && ` · ${contextReveals} context reveal${contextReveals > 1 ? "s" : ""}`}
        </p>

        {/* Personal stats */}
        {progress && (
          <div className="flex items-center justify-center gap-4 mt-3 text-[11px] font-mono text-white/35">
            <span>🧩 {progress.puzzlesSolved} solved</span>
            <span>🔥 {progress.streak} streak</span>
            <span>🌍 {progress.languagesCracked.length} language{progress.languagesCracked.length !== 1 ? "s" : ""}</span>
            {progress.bestTime !== null && (
              <span>⚡ {Math.floor(progress.bestTime / 60)}:{(progress.bestTime % 60).toString().padStart(2, "0")} best</span>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
