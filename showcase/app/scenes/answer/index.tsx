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
          className="relative max-w-md w-full rounded-2xl border border-[#34d399]/30 bg-[#0a1210]/60 px-7 py-7 text-center shadow-2xl backdrop-blur"
        >
          <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
            IOL-AI 2026 · result
          </p>
          <p className="mt-1 text-sm text-white/80">
            the model decoded Apurinã's agreement
          </p>

          {/* all three query answers */}
          <div className="mt-4 space-y-1.5 text-left">
            {[
              ["1", "we (incl.) are eating", "kaakutaka"],
              ["2", "you (sg.) are speaking", "ãnykataka"],
              ["3", "we (incl.) are speaking", "kaanykataka"],
            ].map(([n, q, ans]) => (
              <div
                key={n}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="font-mono text-[11px] text-white/45">{n}</span>
                <span className="flex-1 text-sm text-white/70">{q}</span>
                <span className="font-mono text-sm font-semibold text-[#34e399]">
                  {ans}
                </span>
              </div>
            ))}
          </div>

          {/* derived reasoning — points back at the context rows */}
          <div className="mt-4 rounded-lg border border-white/10 bg-[#0a0f2e]/60 px-4 py-3 text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Here's how
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70">
              <li>
                <span className="text-white/50">row 10</span>{" "}
                <span className="font-mono">kaa·pita·ka</span> = "we incl. are
                going"
              </li>
              <li>
                <span className="text-white/50">rows 4–6</span>{" "}
                <span className="font-mono">·kuta·</span> = "eat" root
              </li>
              <li>
                <span className="text-white/50">every row</span> ending{" "}
                <span className="font-mono">·ka</span> = progressive
              </li>
            </ul>
          </div>

          <p className="mt-4 text-[10px] uppercase tracking-widest text-white/35">
            committed · graded · chain-key signed
          </p>
        </motion.div>
      )}
    </div>
  );
};
