"use client";

import { motion } from "motion/react";
import { useState } from "react";

export const Answer = () => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="scene-stage flex items-center justify-center px-6">
      {!revealed ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-8 text-center shadow-2xl backdrop-blur"
        >
          <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
            IOL-AI 2026 · result
          </p>
          <h2 className="mt-2 text-xl font-bold text-white leading-tight">
            The Answer
          </h2>
          <p className="mt-2 text-sm text-white/60 leading-relaxed">
            10 bilingual pairs. The model locked onto Apurinã's morphology —
            agreement prefixes, verb roots, and a progressive suffix.
          </p>
          <button
            onClick={() => setRevealed(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:border-white/40"
          >
            Reveal the answer
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="revealed"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative max-w-md w-full rounded-2xl border border-[#34d399]/30 bg-[#0a1210]/60 px-8 py-8 text-center shadow-2xl backdrop-blur"
        >
          <p className="font-mono text-3xl font-bold tracking-tight text-[#34d399]">
            kaakutaka
          </p>
          <p className="mt-2 text-base text-white/80">
            — "we (incl.) are eating"
          </p>

          <div className="mt-5 grid grid-cols-3 gap-1.5 text-xs">
            {[
              ["kaa-", "we (incl.)"],
              ["-kuta-", "eat"],
              ["-ka", "progressive"],
            ].map(([morph, gloss]) => (
              <div
                key={morph}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2"
              >
                <p className="font-mono font-semibold text-white/90">{morph}</p>
                <p className="mt-0.5 text-[10px] text-white/50">{gloss}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[10px] uppercase tracking-widest text-white/35">
            committed · graded · chain-key signed
          </p>
        </motion.div>
      )}
    </div>
  );
};
