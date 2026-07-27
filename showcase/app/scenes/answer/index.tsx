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
      className="relative h-screen w-screen overflow-hidden bg-[#0a0f2e]"
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
        <div className="absolute inset-0 flex items-end justify-center pb-24 z-10 pointer-events-none">
          <p className="font-mono text-xs text-white/50 animate-pulse">
            click to reveal answer
          </p>
        </div>
      )}
    </div>
  );
};
