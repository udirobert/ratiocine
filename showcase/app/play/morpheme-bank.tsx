"use client";

import { motion } from "motion/react";

export interface MorphemeBankProps {
  morphemes: string[];
  usedMorphemes: Map<string, number>; // morpheme → count of times used
  selectedMorpheme: string | null;
  onSelect: (morpheme: string) => void;
  revealedMorphemes: Map<string, string>; // morpheme → meaning (from hints)
}

export const MorphemeBank = ({
  morphemes,
  usedMorphemes,
  selectedMorpheme,
  onSelect,
  revealedMorphemes,
}: MorphemeBankProps) => {
  // Count available instances of each morpheme
  // "ka" appears once in the bank but can be used 3 times (one per query)
  // For MVP: morphemes are unlimited (can reuse)
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
          Morpheme Bank
        </span>
        <span className="text-[10px] text-white/50">
          — tap to select, then tap a slot
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {morphemes.map((morpheme, i) => {
          const isSelected = selectedMorpheme === morpheme;
          const revealed = revealedMorphemes.get(morpheme);

          return (
            <motion.button
              key={`${morpheme}-${i}`}
              type="button"
              onClick={() => onSelect(morpheme)}
              whileTap={{ scale: 0.92 }}
              className={`
                relative group px-3 py-2 rounded-md font-mono text-sm font-medium
                border transition-all duration-150 cursor-pointer select-none
                ${
                  isSelected
                    ? "border-amber-400 bg-amber-400/15 text-amber-300 shadow-[0_0_8px_rgba(229,168,75,0.2)]"
                    : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/[0.07]"
                }
              `}
            >
              {morpheme}
              {revealed && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-900/90 px-1.5 py-0.5 text-[9px] text-amber-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {revealed}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
