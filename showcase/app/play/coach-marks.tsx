"use client";

import { motion } from "motion/react";

const COACH_KEY = "ratiocine-seen-coach";

export const hasSeenCoach = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return false;
  }
};

const WARMUP_KEY = "ratiocine-seen-warmup";

export const hasSeenWarmup = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WARMUP_KEY) === "1";
  } catch {
    return false;
  }
};

export const markWarmupSeen = () => {
  try {
    window.localStorage.setItem(WARMUP_KEY, "1");
  } catch {}
};

interface CoachMarksProps {
  onDismiss: () => void;
  accent: string;
}

// Single welcome card — one tap to start. Everything else (tile colors,
// tracing, the machine) is taught in context, at the moment it matters.
export const CoachMarks = ({ onDismiss, accent }: CoachMarksProps) => {
  const finish = () => {
    try {
      window.localStorage.setItem(COACH_KEY, "1");
    } catch {}
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="archive-card relative w-full max-w-sm rounded-2xl p-6 text-center border border-white/10 shadow-2xl">
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close welcome"
        >
          ×
        </button>

        <h3 className="font-display text-xl font-bold text-white mb-3 leading-tight">
          Crack today&apos;s language
        </h3>
        <p className="text-[14px] text-white/70 leading-relaxed">
          Study a few clues in a real language, spot the hidden pattern, then tap
          tiles to build the answers. You&apos;ll pick up the rest as you play.
        </p>

        <div className="mt-6">
          <button
            onClick={finish}
            className="px-8 py-2.5 min-h-[48px] rounded-full text-sm font-bold text-black transition-all"
            style={{ backgroundColor: accent }}
          >
            Start playing
          </button>
        </div>
      </div>
    </motion.div>
  );
};
