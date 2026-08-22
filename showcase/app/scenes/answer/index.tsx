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

      {/* locked state — clear, intentional CTA before reveal */}
      {!exploded && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
              IOL-AI 2026 · result
            </p>
            <h2 className="mt-2 text-xl font-bold text-white leading-tight">
              The Answer
            </h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              10 bilingual pairs. The model locked onto Apurinã's morphology.
              Ready to see what it committed?
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExploded(true);
              }}
              className="pointer-events-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:border-white/40"
            >
              Reveal the answer
            </button>
          </div>
        </div>
      )}

      {/* revealed state — explain the floating word so it has meaning */}
      {exploded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center px-6">
          <div className="max-w-md text-center">
            <p className="font-mono text-2xl font-bold tracking-tight text-[#34d399]">
              kaakutaka
            </p>
            <p className="mt-1 text-sm text-white/70">
              — "we (incl.) are eating"
            </p>
            <p className="mt-1 text-xs text-white/50">
              kaa- (we incl.) · -kuta- (eat) · -ka (progressive)
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-white/35">
              committed · graded · chain-key signed
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
