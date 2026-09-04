"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const COACH_KEY = "ratiocine-seen-coach";
const STEPS = [
  {
    title: "Welcome to the field station",
    body: "Each day you get a few clues in a real, often endangered, language. Your job is to figure out the pattern hiding inside the words.",
  },
  {
    title: "Study the evidence",
    body: "Tap any source word to see where its morphemes appear in the other rows. Look for the prefix, root, and suffix that repeat.",
  },
  {
    title: "Build the answer",
    body: "Tap a morpheme tile to place it in the first empty slot. Green means right slot, yellow means right morpheme but wrong slot, red means not in the answer.",
  },
  {
    title: "Beat the machine",
    body: "After you crack all the queries, a 14B AI tries the same puzzle. Then share your score — especially if you out-solved the machine.",
  },
];

export const hasSeenCoach = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return false;
  }
};

interface CoachMarksProps {
  onDismiss: () => void;
  accent: string;
}

export const CoachMarks = ({ onDismiss, accent }: CoachMarksProps) => {
  const [slide, setSlide] = useState(0);

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
          className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors text-xl leading-none"
          aria-label="Close coach marks"
        >
          ×
        </button>

        <div className="min-h-[140px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="font-display text-xl font-bold text-white mb-3 leading-tight">
                {STEPS[slide].title}
              </h3>
              <p className="text-[14px] text-white/70 leading-relaxed">
                {STEPS[slide].body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 mb-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{ backgroundColor: i === slide ? accent : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          {slide > 0 && (
            <button
              onClick={() => setSlide((s) => s - 1)}
              className="px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Back
            </button>
          )}
          {slide < STEPS.length - 1 ? (
            <button
              onClick={() => setSlide((s) => s + 1)}
              className="px-6 py-2 rounded-full text-sm font-bold text-black transition-all"
              style={{ backgroundColor: accent }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={finish}
              className="px-6 py-2 rounded-full text-sm font-bold text-black transition-all"
              style={{ backgroundColor: accent }}
            >
              Start playing
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
