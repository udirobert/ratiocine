"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { SceneLabel, SceneNav, SceneId, Wordmark } from "@/components/scene-nav";
import { GridBackground } from "@/components/ui/grid-background";
import { HeroOverlay } from "@/components/hero-overlay";

const Problem = dynamic(
  () => import("./scenes/problem/index").then((m) => m.Problem),
  { ssr: false },
);
const Machine = dynamic(
  () => import("./scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);
const Answer = dynamic(
  () => import("./scenes/answer/index").then((m) => m.Answer),
  { ssr: false },
);
const PuzzleView = dynamic(
  () => import("./play/puzzle-view").then((m) => m.PuzzleView),
  { ssr: false },
);

const Home = () => {
  const [scene, setScene] = useState<SceneId>("machine");

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-[#0a0f2e]">
      {/* Grid + chrome hidden during play */}
      {scene !== "play" && (
        <>
          <GridBackground className="bg-[#0a0f2e]" />
          <SceneLabel current={scene} />
          <Wordmark />
        </>
      )}

      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {scene === "problem" && (
            <motion.div
              key="problem"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Problem />
            </motion.div>
          )}
          {scene === "machine" && (
            <motion.div
              key="machine"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Machine />
              {/* Play CTA overlaid on Mac scene */}
              <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center pointer-events-none">
                <button
                  onClick={() => setScene("play")}
                  className="pointer-events-auto px-6 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 backdrop-blur text-amber-300 font-mono text-sm font-medium hover:bg-amber-400/20 hover:border-amber-400/60 transition-all shadow-[0_0_20px_rgba(229,168,75,0.1)]"
                >
                  ▶ Play the Apurinã puzzle
                </button>
              </div>
            </motion.div>
          )}
          {scene === "answer" && (
            <motion.div
              key="answer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Answer />
            </motion.div>
          )}
          {scene === "play" && (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="h-full w-full"
            >
              <PuzzleView onBack={() => setScene("machine")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav hidden during play (puzzle has its own back button) */}
      {scene !== "play" && (
        <SceneNav current={scene} onChange={setScene} />
      )}

      {/* Hero overlay only on first visit */}
      {scene !== "play" && <HeroOverlay />}
    </main>
  );
};

export default Home;
