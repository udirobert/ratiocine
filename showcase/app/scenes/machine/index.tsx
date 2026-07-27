"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { PartnerLogos } from "./partner-logos";
import { ScreenContent } from "./screen-content";

interface PaintCanvas extends HTMLCanvasElement {
  requestPaint: () => void;
  onpaint: (() => void) | null;
}

interface DrawCtx extends CanvasRenderingContext2D {
  drawElementImage: (el: HTMLElement, x: number, y: number) => void;
}

const MacScene = dynamic(
  () => import("./mac-scene").then((m) => m.MacScene),
  { ssr: false },
);

const SCREEN_W = 562;
const SCREEN_H = 408;

export const Machine = () => {
  const canvasRef = useRef<PaintCanvas>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const screenElRef = useRef<HTMLDivElement>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);

  // Try to wire up the html-in-canvas pipeline for the screen texture
  const handleCanvasMount = (canvas: PaintCanvas | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as DrawCtx | null;
    const content = contentRef.current;
    if (!ctx || !content || typeof ctx.drawElementImage !== "function") {
      setApiSupported(false);
      return;
    }
    setApiSupported(true);
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    canvas.onpaint = () => {
      ctx.reset();
      ctx.drawElementImage(content, 0, 0);
    };
    canvas.requestPaint();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0f2e]">
      {/* hidden html-in-canvas source for screen texture (when API supported) */}
      {apiSupported !== false && (
        <canvas
          ref={(el) => {
            (canvasRef as React.MutableRefObject<PaintCanvas | null>).current =
              el as PaintCanvas;
            handleCanvasMount(el as PaintCanvas);
          }}
          // @ts-expect-error layoutsubtree is html-in-canvas specific
          layoutsubtree="true"
          suppressHydrationWarning
          className="absolute -left-[9999px] -top-[9999px]"
          style={{ width: SCREEN_W, height: SCREEN_H }}
        >
          <div
            ref={contentRef}
            style={{ width: SCREEN_W, height: SCREEN_H }}
          >
            <ScreenContent />
          </div>
        </canvas>
      )}

      {/* Fallback: visible screen div sampled via CanvasTexture */}
      {apiSupported === false && (
        <div
          ref={screenElRef}
          className="absolute -left-[9999px] -top-[9999px]"
          style={{ width: SCREEN_W, height: SCREEN_H }}
        >
          <ScreenContent />
        </div>
      )}

      {/* 3D Mac */}
      <MacScene screenElRef={apiSupported === false ? screenElRef : canvasRef as unknown as React.RefObject<HTMLDivElement>} />

      {/* partner list */}
      <PartnerLogos />

      {/* headline */}
      <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 max-w-xs">
        <p className="font-mono text-xs text-white/40 uppercase tracking-widest mb-2">
          IOL-AI 2026 · stack
        </p>
        <h2 className="text-2xl font-bold text-white leading-tight">
          The Machine
        </h2>
        <p className="mt-2 text-sm text-white/50 leading-relaxed">
          Qwen2.5-14B-AWQ on a T4.
          <br />
          Hybrid CoT. Adaptive time guard.
          <br />
          Best public: <span className="text-[#34d399] font-mono font-bold">0.1141</span>
        </p>
        <p className="mt-3 text-xs text-white/30">
          Drag to rotate ↗
        </p>
      </div>
    </div>
  );
};
