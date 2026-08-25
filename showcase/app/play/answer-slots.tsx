"use client";

import { motion, AnimatePresence } from "motion/react";
import type { TileGrade } from "./puzzle-data";

export interface SlotData {
  morpheme: string | null;
  grade?: TileGrade;
}

export interface AnswerSlotsProps {
  queryId: number;
  prompt: string;
  slots: SlotData[];
  isGraded: boolean;
  isCorrect: boolean;
  selectedMorpheme: string | null;
  onSlotTap: (queryId: number, slotIndex: number) => void;
  onSlotRemove: (queryId: number, slotIndex: number) => void;
}

const gradeColor = (grade?: TileGrade) => {
  switch (grade) {
    case "correct":
      return "border-emerald-400 bg-emerald-400/15 text-emerald-300";
    case "misplaced":
      return "border-amber-400 bg-amber-400/15 text-amber-300";
    case "wrong":
      return "border-red-400/60 bg-red-400/10 text-red-300/70";
    default:
      return "";
  }
};

export const AnswerSlots = ({
  queryId,
  prompt,
  slots,
  isGraded,
  isCorrect,
  selectedMorpheme,
  onSlotTap,
  onSlotRemove,
}: AnswerSlotsProps) => {
  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${
        isGraded && isCorrect
          ? "border-emerald-400/40 bg-emerald-400/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {/* Query prompt */}
      <div className="flex items-start gap-2 mb-3">
        <span className="font-mono text-xs text-white/40 mt-0.5 shrink-0">
          {queryId}.
        </span>
        <span className="text-sm text-white/80">{prompt}</span>
        {isGraded && isCorrect && (
          <span className="ml-auto text-emerald-400 text-xs font-mono shrink-0">
            ✓
          </span>
        )}
      </div>

      {/* Slots */}
      <div className="flex flex-wrap gap-2">
        {slots.map((slot, i) => (
          <motion.button
            key={i}
            type="button"
            layout
            onClick={() => {
              if (isGraded) return;
              if (slot.morpheme) {
                onSlotRemove(queryId, i);
              } else {
                onSlotTap(queryId, i);
              }
            }}
            className={`
              relative min-w-[40px] min-h-[36px] px-3 py-2 rounded-md font-mono text-sm
              border transition-all duration-150
              ${
                isGraded && slot.grade
                  ? gradeColor(slot.grade)
                  : slot.morpheme
                    ? "border-white/25 bg-white/[0.06] text-white/90 hover:border-red-300/40 cursor-pointer"
                    : selectedMorpheme
                      ? "border-amber-400/40 bg-amber-400/[0.04] border-dashed cursor-pointer animate-pulse"
                      : "border-white/10 bg-white/[0.02] border-dashed text-white/35 cursor-pointer"
              }
            `}
          >
            <AnimatePresence mode="wait">
              {slot.morpheme ? (
                <motion.span
                  key={slot.morpheme}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                >
                  {slot.morpheme}
                </motion.span>
              ) : (
                <motion.span
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/35"
                >
                  ·
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}

        {/* Add slot button (when not graded and has content) */}
        {!isGraded && (
          <button
            type="button"
            onClick={() => onSlotTap(queryId, slots.length)}
            className="min-w-[36px] min-h-[36px] px-2 py-2 rounded-md border border-dashed border-white/10 text-white/35 hover:border-white/25 hover:text-white/40 transition-colors text-lg leading-none"
            aria-label="Add morpheme slot"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};
