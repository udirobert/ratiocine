"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { drawAnswerCard, CARD_H, CARD_W } from "./answer-canvas";

const VoronoiScene = dynamic(
  () => import("./voronoi-scene").then((m) => m.VoronoiScene),
  { ssr: false },
);

export const Answer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exploded, setExploded] = useState(false);
  const [ready, setReady] = useState(false);

  // Draw the answer card to a 2D canvas once — this becomes the
  // CanvasTexture for both the static plane and the Voronoi shards.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawAnswerCard(ctx);
    // give the texture a frame before the 3D scene samples it
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="scene-stage"
      onClick={() => !exploded && setExploded(true)}
    >
      {/* offscreen 2D canvas with the answer card drawn into it */}
      <canvas
        ref={canvasRef}
        width={CARD_W}
        height={CARD_H}
        className="absolute -left-[9999px] -top-[9999px]"
      />

      {/* 3D Voronoi scene — samples the canvas as a CanvasTexture */}
      {ready && (
        <VoronoiScene canvasRef={canvasRef} exploded={exploded} />
      )}

      {/* hint overlay when not yet exploded */}
      {!exploded && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
          <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center px-6">
            <div className="max-w-xl text-center">
              <p className="font-mono text-xs text-white/50 uppercase tracking-widest mb-2">
                IOL-AI 2026 · result
              </p>
              <h2 className="text-2xl font-bold text-white leading-tight">
                The Answer
              </h2>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                The solver reasons through morphology, then commits its best
                answer — graded and signed in-canister.
              </p>
            </div>
          </div>
          <p className="font-mono text-xs text-white/50 animate-pulse">
            click to reveal answer
          </p>
        </div>
      )}
    </div>
  );
};
