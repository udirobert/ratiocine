"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { PuzzlePreview } from "./puzzle-data";

interface WarmupTeaserProps {
  preview: PuzzlePreview;
}

export const WarmupTeaser = ({ preview }: WarmupTeaserProps) => {
  const { warmup, theme } = preview;
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);

  if (!warmup) {
    return (
      <div className="text-center py-3">
        <p className="text-sm font-bold text-white/80">{preview.language}</p>
        <p className="font-mono text-[11px] text-white/40 mt-0.5">Coming soon</p>
      </div>
    );
  }

  const isCorrect = guess.trim().toLowerCase() === warmup.answer.toLowerCase();

  const handleSubmit = () => {
    setRevealed(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-white/8 bg-white/[0.01] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
          Tomorrow&apos;s warmup
        </p>
        <p className="text-sm font-bold text-white/80 mt-0.5" style={{ color: theme.accent }}>
          {preview.language}
        </p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Mini evidence */}
        {warmup.pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="font-mono" style={{ color: `${theme.sourceColor}cc` }}>
              {pair.source}
            </span>
            <span className="text-white/20">→</span>
            <span className="text-white/60">{pair.target}</span>
          </div>
        ))}

        {/* Query */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[12px] text-white/70 mb-2">{warmup.query}</p>

          {!revealed ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="your guess..."
                className="flex-1 bg-white/[0.03] border border-white/10 rounded px-3 py-1.5 text-[12px] font-mono text-white/80 placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
              />
              <button
                onClick={handleSubmit}
                disabled={!guess.trim()}
                className="px-3 py-1.5 rounded text-[11px] font-mono font-bold text-black disabled:opacity-30 transition-all"
                style={{ backgroundColor: theme.accent }}
              >
                ↵
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[12px] font-mono"
            >
              {isCorrect ? (
                <span style={{ color: theme.accent }}>✓ Correct — you&apos;re ready.</span>
              ) : (
                <span className="text-white/60">
                  Answer: <span style={{ color: theme.accent }}>{warmup.answer}</span>
                  <span className="text-white/30 ml-2">Come back tomorrow for the full puzzle.</span>
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
