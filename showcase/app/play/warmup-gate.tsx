"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { buildTodayWarmup, type Puzzle } from "./puzzle-data";
import { LEVELS, getLevel, setLevel, type Level } from "./level";
import { WarmupTeaser } from "./warmup-teaser";

interface WarmupGateProps {
  puzzle: Puzzle;
  onContinue: () => void;
}

// First-time gate: one tap-sized warmup drawn from TODAY's puzzle (its
// tutorial query), so everything learned transfers into the solve phase.
export const WarmupGate = ({ puzzle, onContinue }: WarmupGateProps) => {
  const [level, setLevelState] = useState<Level>(() => getLevel());
  const preview = {
    language: puzzle.language,
    script: "",
    difficulty: 1,
    family: puzzle.family,
    theme: puzzle.theme,
    warmup: buildTodayWarmup(puzzle),
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6 sm:py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="m-auto w-full max-w-sm"
      >
        <p className="text-center text-white/40 text-[10px] sm:text-[11px] font-mono uppercase tracking-widest mb-3 sm:mb-4">
          Quick warm-up — today&apos;s language
        </p>
        <WarmupTeaser preview={preview} title="Warm-up" />
        <div className="mt-4 sm:mt-5" role="group" aria-label="Practice level">
          <p className="text-center text-[10px] sm:text-[11px] font-mono text-white/40 mb-2">
            How much help do you want?
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLevel(l.id); setLevelState(l.id); }}
                aria-pressed={level === l.id}
                className={`rounded-lg border px-2 py-2 sm:py-2.5 min-h-[44px] sm:min-h-[48px] transition-all ${
                  level === l.id
                    ? "pa-bg-15 pa-border-40 pa-text"
                    : "border-white/10 text-white/55 hover:border-white/25"
                }`}
              >
                <span className="block text-[12px] sm:text-[13px] font-bold">{l.label}</span>
                <span className="block text-[9px] sm:text-[10px] opacity-70 mt-0.5 leading-tight">{l.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onContinue}
          className="mt-4 sm:mt-5 w-full px-6 py-3 rounded-full text-sm font-bold text-black transition-all hover:brightness-110 min-h-[44px] sm:min-h-[48px]"
          style={{ backgroundColor: puzzle.theme.accent }}
        >
          Start today&apos;s puzzle →
        </button>
      </motion.div>
    </div>
  );
};
