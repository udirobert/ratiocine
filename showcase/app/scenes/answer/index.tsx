"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { AnswerCard } from "./answer-card";

interface PaintCanvas extends HTMLCanvasElement {
  requestPaint: () => void;
  onpaint: (() => void) | null;
}
interface DrawCtx extends CanvasRenderingContext2D {
  drawElementImage: (el: HTMLElement, x: number, y: number) => void;
}

const VoronoiScene = dynamic(
  () => import("./voronoi-scene").then((m) => m.VoronoiScene),
  { ssr: false },
);

const CARD_W = 560;
const CARD_H = 380;

export const Answer = () => {
  const canvasRef = useRef<PaintCanvas>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const [exploded, setExploded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [apiSupported, setApiSupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;
    const ctx = canvas.getContext("2d") as DrawCtx | null;
    if (!ctx || typeof ctx.drawElementImage !== "function") return;

    setApiSupported(true);
    canvas.width = CARD_W;
    canvas.height = CARD_H;

    canvas.onpaint = () => {
      ctx.reset();
      ctx.drawElementImage(content, 0, 0);
    };
    const resize = () => canvas.requestPaint();
    window.addEventListener("resize", resize);
    canvas.requestPaint();

    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setSceneReady(true));
    });
    return () => {
      window.removeEventListener("resize", resize);
      canvas.onpaint = null;
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  // Fallback: draw content to an offscreen canvas via html2canvas-lite approach
  useEffect(() => {
    if (apiSupported) return;
    setSceneReady(true);
  }, [apiSupported]);

  const effectiveCanvasRef = apiSupported ? canvasRef : fallbackRef;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#0a0f2e]"
      onClick={() => !exploded && setExploded(true)}
    >
      {/* html-in-canvas source */}
      {apiSupported && (
        <canvas
          ref={canvasRef}
          // @ts-expect-error layoutsubtree is html-in-canvas attribute
          layoutsubtree="true"
          suppressHydrationWarning
          className="absolute -left-[9999px] -top-[9999px]"
          style={{ width: CARD_W, height: CARD_H }}
        >
          <div ref={contentRef} style={{ width: CARD_W, height: CARD_H }}>
            <AnswerCard />
          </div>
        </canvas>
      )}

      {/* Fallback canvas */}
      {!apiSupported && (
        <canvas
          ref={fallbackRef}
          width={CARD_W}
          height={CARD_H}
          className="absolute -left-[9999px] -top-[9999px]"
        />
      )}

      {/* Visible fallback when not exploded + no API */}
      {!apiSupported && !exploded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ width: CARD_W, height: CARD_H }}>
            <AnswerCard />
          </div>
        </div>
      )}

      {/* 3D canvas */}
      {sceneReady && (
        <VoronoiScene
          canvasRef={effectiveCanvasRef as React.RefObject<HTMLCanvasElement | null>}
          exploded={exploded}
        />
      )}

      {/* hint overlay when not yet exploded */}
      {!exploded && (
        <div className="absolute inset-0 flex items-end justify-center pb-24 z-10 pointer-events-none">
          <p className="font-mono text-xs text-white/30 animate-pulse">
            click to reveal answer
          </p>
        </div>
      )}

      {/* browser flag notice */}
      {!apiSupported && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-black/60 border border-white/10 text-xs text-white/40 font-mono whitespace-nowrap">
          Enable chrome://flags/#canvas-draw-element for HTMLTexture rendering
        </div>
      )}
    </div>
  );
};
