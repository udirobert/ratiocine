"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { GridBackground } from "@/components/ui/grid-background";

type SceneId = "problem" | "machine" | "answer";

const Problem = dynamic(
  () => import("../scenes/problem/index").then((m) => m.Problem),
  { ssr: false },
);
const Machine = dynamic(
  () => import("../scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);
const Answer = dynamic(
  () => import("../scenes/answer/index").then((m) => m.Answer),
  { ssr: false },
);

const SCENES: { id: SceneId; label: string }[] = [
  { id: "problem", label: "Problem" },
  { id: "machine", label: "Machine" },
  { id: "answer", label: "Answer" },
];

export const ExploreClient = () => {
  const [scene, setScene] = useState<SceneId>("problem");

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-[#0a0f2e]">
      <GridBackground className="bg-[#0a0f2e]" />

      {/* Back + scene dots */}
      <div className="fixed top-5 left-5 z-50 flex items-center gap-4">
        <Link
          href="/"
          className="font-mono text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          ← Home
        </Link>
        <div className="flex items-center gap-1">
          {SCENES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScene(s.id)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                scene === s.id
                  ? "text-white/90 bg-white/10"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            {scene === "problem" && <Problem />}
            {scene === "machine" && <Machine />}
            {scene === "answer" && <Answer />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
};
