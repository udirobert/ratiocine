"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export const HeroOverlay = () => {
  const [visible, setVisible] = useState(true);

  // dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f2e]/80 backdrop-blur-md"
          onClick={() => setVisible(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mx-6 max-w-sm max-h-[90svh] overflow-y-auto rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-10 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h1 className="text-4xl font-bold tracking-tight text-white">
              ratiocine
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              Crack the pattern. Then watch the machine try.
            </p>

            <a
              href="/play"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-7 py-3 text-sm font-bold text-black transition-all hover:bg-amber-400"
            >
              Play
              <ArrowRightIcon
                weight="bold"
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </a>

            <p className="mt-6 font-mono text-[10px] text-white/30 uppercase tracking-widest">
              IOL-AI 2026 Competitor · Score{" "}
              <span className="text-emerald-400/60">0.1141</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
