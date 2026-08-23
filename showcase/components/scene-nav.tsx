"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";

export type SceneId = "problem" | "machine" | "answer" | "play";

const SCENES: { id: SceneId; label: string; index: number }[] = [
  { id: "problem", label: "The Problem", index: 0 },
  { id: "machine", label: "The Machine", index: 1 },
  { id: "answer", label: "The Answer", index: 2 },
  { id: "play", label: "Play", index: 3 },
];

interface SceneNavProps {
  current: SceneId;
  onChange: (id: SceneId) => void;
}

export const SceneNav = ({ current, onChange }: SceneNavProps) => {
  const currentIndex = SCENES.findIndex((s) => s.id === current);
  const prev = SCENES[currentIndex - 1];
  const next = SCENES[currentIndex + 1];

  return (
    <nav className="fixed bottom-6 inset-x-0 z-40 flex items-center justify-center gap-4 pointer-events-none pb-[env(safe-area-inset-bottom)]">
      {/* prev arrow */}
      <button
        onClick={() => prev && onChange(prev.id)}
        disabled={!prev}
        aria-label="Previous scene"
        className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur text-white/60 hover:text-white hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none transition-all"
      >
        <ArrowLeftIcon weight="bold" className="size-4" />
      </button>

      {/* dots — 44px minimum tap targets */}
      <div className="pointer-events-auto flex items-center gap-1">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            onClick={() => onChange(scene.id)}
            aria-label={scene.label}
            title={scene.label}
            className="relative flex flex-col items-center justify-center gap-1 group min-w-[44px] min-h-[44px]"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                scene.id === current
                  ? "w-6 h-2 bg-white"
                  : "w-2.5 h-2.5 bg-white/40 group-hover:bg-white/70"
              }`}
            />
            <span
              className={`font-mono text-[10px] tracking-wide transition-colors ${
                scene.id === current ? "text-white/70" : "text-white/30"
              }`}
            >
              {scene.label.replace("The ", "")}
            </span>
          </button>
        ))}
      </div>

      {/* next arrow */}
      <button
        onClick={() => next && onChange(next.id)}
        disabled={!next}
        aria-label="Next scene"
        className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur text-white/60 hover:text-white hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none transition-all"
      >
        <ArrowRightIcon weight="bold" className="size-4" />
      </button>
    </nav>
  );
};

/* Thin scene label that appears top-left */
export const SceneLabel = ({ current }: { current: SceneId }) => {
  const scene = SCENES.find((s) => s.id === current)!;
  return (
    <motion.div
      key={current}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      className="fixed top-5 left-5 z-50 flex items-center gap-2"
    >
      <span className="font-mono text-xs text-white/55 tabular-nums">
        {String(scene.index + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
      </span>
      <span className="text-sm font-semibold text-white/85 tracking-wide">
        {scene.label}
      </span>
    </motion.div>
  );
};

/* Top-right: ratiocine wordmark */
export const Wordmark = () => (
  <div className="fixed top-5 right-5 z-50">
    <a
      href="https://github.com/udirobert/ratiocine"
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-sm font-bold tracking-tight text-white/70 hover:text-white transition-colors"
    >
      ratiocine
    </a>
  </div>
);
