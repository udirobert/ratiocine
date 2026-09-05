"use client";

import { motion } from "motion/react";
import { buildTodayWarmup, type Puzzle } from "./puzzle-data";
import { WarmupTeaser } from "./warmup-teaser";

interface WarmupGateProps {
  puzzle: Puzzle;
  onContinue: () => void;
}

// First-time gate: one tap-sized warmup drawn from TODAY's puzzle (its
// tutorial query), so everything learned transfers into the solve phase.
export const WarmupGate = ({ puzzle, onContinue }: WarmupGateProps) => {
  const preview = {
    language: puzzle.language,
    script: "",
    difficulty: 1,
    family: puzzle.family,
    theme: puzzle.theme,
    warmup: buildTodayWarmup(puzzle),
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full"
      >
        <p className="text-center text-white/40 text-[11px] font-mono uppercase tracking-widest mb-4">
          Quick warm-up — today&apos;s language
        </p>
        <WarmupTeaser preview={preview} title="Warm-up" />
        <button
          onClick={onContinue}
          className="mt-5 w-full px-6 py-3 rounded-full text-sm font-bold text-black transition-all hover:brightness-110 min-h-[48px]"
          style={{ backgroundColor: puzzle.theme.accent }}
        >
          Start today&apos;s puzzle →
        </button>
      </motion.div>
    </div>
  );
};
