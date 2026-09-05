"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { warmupChoices, type PuzzlePreview } from "./puzzle-data";

interface WarmupTeaserProps {
  preview: PuzzlePreview;
  /** Header label — "Warm-up" in the gate, "Tomorrow's warmup" on the result screen */
  title?: string;
}

export const WarmupTeaser = ({ preview, title = "Tomorrow's warmup" }: WarmupTeaserProps) => {
  const { warmup, theme } = preview;
  const [picked, setPicked] = useState<string | null>(null);

  const choices = useMemo(() => (warmup ? warmupChoices(warmup) : []), [warmup]);

  if (!warmup) {
    return (
      <div className="text-center py-3">
        <p className="text-sm font-bold text-white/80">{preview.language}</p>
        <p className="font-mono text-[11px] text-white/40 mt-0.5">Coming soon</p>
      </div>
    );
  }

  const revealed = picked !== null;
  const isCorrect = picked === warmup.answer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-solid rounded-lg border border-white/10 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
          {title}
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

          {/* Multiple-choice — tap, never type */}
          <div className="flex flex-col gap-2" role="group" aria-label="Warm-up choices">
            {choices.map((choice) => {
              const selected = picked === choice;
              const correct = choice === warmup.answer;
              return (
                <button
                  key={choice}
                  onClick={() => !revealed && setPicked(choice)}
                  disabled={revealed}
                  className={`w-full rounded-lg border px-3 py-2.5 min-h-[44px] text-left text-[13px] font-mono transition-all ${
                    revealed && correct
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                      : revealed && selected
                        ? "border-red-400/50 bg-red-400/10 text-red-300/80"
                        : revealed
                          ? "border-white/8 text-white/35"
                          : "border-white/15 text-white/80 hover:border-white/30 hover:bg-white/5 active:scale-[0.99]"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="mr-2" aria-hidden="true">
                    {revealed && correct ? "✓" : revealed && selected ? "✗" : "○"}
                  </span>
                  {choice}
                </button>
              );
            })}
          </div>

          {revealed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-[12px] font-mono text-white/60"
              aria-live="polite"
            >
              {isCorrect ? (
                <span style={{ color: theme.accent }}>✓ Correct — you&apos;re ready.</span>
              ) : (
                <span>
                  The answer was <span style={{ color: theme.accent }}>{warmup.answer}</span>
                  <span className="text-white/30 ml-2">You&apos;ll crack the pattern below.</span>
                </span>
              )}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
