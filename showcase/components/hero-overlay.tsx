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
            className="relative mx-6 max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-10 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
              IOL-AI 2026 · Entry
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
              ratiocine
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              An AI that solves International Linguistics Olympiad problems —
              translating endangered languages, filling paradigms, and
              decoding number systems from a handful of examples.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              160 problems. 15 languages. 30 minutes on a single T4 GPU.
              <br />
              Best public score:{" "}
              <span className="font-mono font-bold text-[#34d399]">0.1141</span>
            </p>

            <button
              onClick={() => setVisible(false)}
              className="group mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white/90 transition-all hover:bg-white/20 hover:border-white/40"
            >
              Explore the build
              <ArrowRightIcon
                weight="bold"
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </button>

            <p className="mt-4 text-xs text-white/35">
              Three scenes: the machine · the problem · the answer
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
