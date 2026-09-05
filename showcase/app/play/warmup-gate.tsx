"use client";

import { motion } from "motion/react";
import type { PuzzlePreview } from "./puzzle-data";
import { WarmupTeaser } from "./warmup-teaser";

interface WarmupGateProps {
  preview: PuzzlePreview;
  onContinue: () => void;
}

export const WarmupGate = ({ preview, onContinue }: WarmupGateProps) => (
  <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-sm w-full"
    >
      <p className="text-center text-white/40 text-[11px] font-mono uppercase tracking-widest mb-4">
        First-time warm-up — not today&apos;s puzzle
      </p>
      <WarmupTeaser preview={preview} />
      <button
        onClick={onContinue}
        className="mt-5 w-full px-6 py-3 rounded-full text-sm font-bold text-black transition-all hover:brightness-110"
        style={{ backgroundColor: preview.theme.accent }}
      >
        Start today&apos;s puzzle →
      </button>
    </motion.div>
  </div>
);
