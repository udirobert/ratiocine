"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { GridBackground } from "@/components/ui/grid-background";

const Machine = dynamic(
  () => import("./scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);
const PuzzleView = dynamic(
  () => import("./play/puzzle-view").then((m) => m.PuzzleView),
  { ssr: false },
);

type Phase = "landing" | "pre-flash" | "expanding" | "game";

const Home = () => {
  const [phase, setPhase] = useState<Phase>("landing");
  const [isMobile, setIsMobile] = useState(false);
  const [clipInset, setClipInset] = useState("35% 32% 35% 32%"); // CRT bounds approx

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  const handlePlay = useCallback(() => {
    if (phase !== "landing") return;

    // Phase 1: pre-flash (200ms)
    setPhase("pre-flash");

    setTimeout(() => {
      // Phase 2: clip expansion (600ms spring)
      setPhase("expanding");
      setClipInset("0% 0% 0% 0%");

      setTimeout(() => {
        // Phase 3: game fully revealed
        setPhase("game");
        // Update URL without navigation
        window.history.replaceState(null, "", "/play");
      }, 700);
    }, 200);
  }, [phase]);

  const handleBack = useCallback(() => {
    setPhase("landing");
    setClipInset("35% 32% 35% 32%");
    window.history.replaceState(null, "", "/");
  }, []);

  // Check if we landed directly on /play
  useEffect(() => {
    if (window.location.pathname === "/play") {
      setPhase("game");
      setClipInset("0% 0% 0% 0%");
    }
  }, []);

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-[#0a0c10]">

      {/* Layer 1: Game content (always rendered, revealed by clip) */}
      <div
        className="absolute inset-0 z-20"
        style={{
          clipPath: `inset(${clipInset} round 8px)`,
          transition: phase === "expanding"
            ? "clip-path 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : phase === "game"
              ? "none"
              : "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {(phase === "expanding" || phase === "game" || phase === "pre-flash") && (
          <PuzzleView onBack={handleBack} />
        )}
      </div>

      {/* Grain edge overlay — visible during expansion */}
      {phase === "expanding" && (
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{
            clipPath: `inset(${clipInset} round 8px)`,
            transition: "clip-path 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="absolute inset-0 mix-blend-overlay opacity-40 grain-noise" />
        </div>
      )}

      {/* Layer 2: Landing (Mac scene + grid) — hidden once game is fully open */}
      {phase !== "game" && (
        <div className="absolute inset-0 z-10">
          <GridBackground className="bg-[#0a0f2e]" />

          {/* Wordmark */}
          <div className="fixed top-5 right-5 z-50">
            <a
              href="https://github.com/udirobert/ratiocine"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm font-bold tracking-tight text-white/80 hover:text-white transition-colors"
            >
              ratiocine
            </a>
          </div>

          {/* CRT pre-flash overlay */}
          {phase === "pre-flash" && (
            <motion.div
              className="absolute inset-0 z-40 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0.3, 0.9, 0] }}
              transition={{ duration: 0.2, times: [0, 0.2, 0.5, 0.7, 1] }}
            >
              <div className="absolute inset-0 bg-white/5 grain-noise mix-blend-screen" />
              {/* Scan line intensification */}
              <div className="absolute inset-0" style={{
                backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
              }} />
            </motion.div>
          )}

          <Machine onPlay={handlePlay} zooming={phase !== "landing"} />
        </div>
      )}
    </main>
  );
};

export default Home;
