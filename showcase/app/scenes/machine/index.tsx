"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import { PartnerLogos } from "./partner-logos";
import { drawScreen, SCREEN_H, SCREEN_W } from "./screen-canvas";

const MacScene = dynamic(
  () => import("./mac-scene").then((m) => m.MacScene),
  { ssr: false },
);

export const Machine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drive the typewriter + score-arc animation on a 2D canvas,
  // then let MacScene sample it as a CanvasTexture (universal, no flags).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lineIndex = 0;
    let scoreIndex = 0;
    let lineTimer = 0;
    let scoreTimer = 0;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = now - last;
      last = now;

      // typewriter: advance a code line every ~140ms (first line slower)
      lineTimer += dt;
      const lineInterval = lineIndex === 0 ? 600 : 140;
      if (lineTimer >= lineInterval && lineIndex < CODE_LINE_COUNT) {
        lineIndex++;
        lineTimer = 0;
      }

      // score arc: reveal a bar every ~900ms (first after 1500ms)
      scoreTimer += dt;
      const scoreInterval = scoreIndex === 0 ? 1500 : 900;
      if (scoreTimer >= scoreInterval && scoreIndex < SCORE_COUNT) {
        scoreIndex++;
        scoreTimer = 0;
      }

      drawScreen(ctx, lineIndex, scoreIndex);
      raf = requestAnimationFrame(step);
    };

    drawScreen(ctx, 0, 0);
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0f2e]">
      {/* offscreen 2D canvas sampled by the 3D Mac screen */}
      <canvas
        ref={canvasRef}
        width={SCREEN_W}
        height={SCREEN_H}
        className="absolute -left-[9999px] -top-[9999px]"
      />

      {/* 3D Mac */}
      <MacScene screenCanvasRef={canvasRef} />

      {/* partner list */}
      <PartnerLogos />

      {/* headline */}
      <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 max-w-xs">
        <p className="font-mono text-xs text-white/50 uppercase tracking-widest mb-2">
          IOL-AI 2026 · stack
        </p>
        <h2 className="text-2xl font-bold text-white leading-tight">
          The Machine
        </h2>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          Qwen2.5-14B-AWQ on a T4.
          <br />
          Hybrid CoT. Adaptive time guard.
          <br />
          Best public:{" "}
          <span className="text-[#34d399] font-mono font-bold">0.1141</span>
        </p>
        <p className="mt-3 text-xs text-white/40">Drag to rotate ↗</p>
      </div>
    </div>
  );
};

const CODE_LINE_COUNT = 28;
const SCORE_COUNT = 6;
