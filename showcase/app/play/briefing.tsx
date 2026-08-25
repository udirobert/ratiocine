"use client";

import { motion } from "motion/react";
import { useCallback, useMemo } from "react";
import type { Puzzle } from "./puzzle-data";

interface BriefingProps {
  puzzle: Puzzle;
  onDismiss: () => void;
}

export const Briefing = ({ puzzle, onDismiss }: BriefingProps) => {
  // Split language name into characters for staggered animation
  const chars = useMemo(() => puzzle.language.split(""), [puzzle.language]);

  // Generate echo lines (repetitive typography effect)
  const echoCount = 5;

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 cursor-pointer overflow-hidden"
      onClick={handleDismiss}
    >
      <div className="relative max-w-md w-full text-center">

        {/* Echo lines — repetitive typography behind the main title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" aria-hidden="true">
          {Array.from({ length: echoCount }).map((_, i) => (
            <motion.p
              key={`echo-${i}`}
              initial={{ opacity: 0, y: 20 + i * 4 }}
              animate={{ opacity: 0.03 + i * 0.015, y: (i - Math.floor(echoCount / 2)) * 38 }}
              transition={{ delay: 0.8 + i * 0.08, duration: 0.8, ease: "easeOut" }}
              className="text-4xl sm:text-5xl font-bold tracking-tight text-white whitespace-nowrap select-none"
              style={{ filter: `blur(${i * 0.5}px)` }}
            >
              {puzzle.language}
            </motion.p>
          ))}
        </div>

        {/* Main title — character-level stagger */}
        <motion.h2
          className="relative text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6 z-10"
          initial="hidden"
          animate="visible"
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              variants={{
                hidden: { opacity: 0, y: i % 2 === 0 ? -30 : 30, rotateX: 60 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              transition={{
                delay: 0.1 + i * 0.04,
                duration: 0.5,
                ease: [0.2, 0.65, 0.3, 0.9],
              }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.h2>

        {/* Metadata — staggered lines */}
        <motion.div
          className="relative z-10 space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15, delayChildren: 0.6 } },
          }}
        >
          {/* Region */}
          <motion.p
            variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
            className="text-[13px] text-white/60 font-mono"
          >
            📍 {puzzle.region}
          </motion.p>

          {/* Speakers + endangerment */}
          <motion.div
            variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
            className="flex items-center justify-center gap-3"
          >
            <span className="text-[13px] text-white/70">
              <span className="text-amber-300/90 font-mono font-bold">~2,800</span> speakers
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-400/40 text-red-300/80 font-mono uppercase">
              endangered
            </span>
          </motion.div>

          {/* Hook — the line that makes you care */}
          <motion.p
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: 0.6 }}
            className="text-[15px] text-white/80 leading-relaxed italic pt-2 max-w-xs mx-auto"
          >
            &ldquo;{puzzle.lore.briefingHook}&rdquo;
          </motion.p>

          {/* Lineage */}
          <motion.p
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            className="text-[12px] text-white/55 leading-relaxed max-w-xs mx-auto"
          >
            {puzzle.lore.lineageNote}
          </motion.p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="relative z-10 pt-8"
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            className="px-6 py-2.5 rounded-md bg-amber-500/90 text-sm font-bold text-black hover:bg-amber-400 transition-colors"
          >
            Begin decipherment
          </button>
          <p className="mt-3 text-[10px] text-white/40 font-mono">tap anywhere to skip</p>
        </motion.div>
      </div>
    </div>
  );
};
