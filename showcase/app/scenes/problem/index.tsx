"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { ProblemContent } from "./problem-content";

interface PaintCanvas extends HTMLCanvasElement {
  requestPaint: () => void;
  onpaint: (() => void) | null;
}

interface DrawCtx extends CanvasRenderingContext2D {
  drawElementImage: (el: HTMLElement, x: number, y: number) => void;
}

const ShaderCanvas = dynamic(
  () => import("./shader-canvas").then((m) => m.ShaderCanvas),
  { ssr: false },
);

export const Problem = () => {
  const canvasRef = useRef<PaintCanvas>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [shaderReady, setShaderReady] = useState(false);
  const [apiSupported, setApiSupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;

    const ctx = canvas.getContext("2d") as DrawCtx | null;
    // Feature-detect the html-in-canvas API
    if (ctx && typeof ctx.drawElementImage === "function") {
      setApiSupported(true);
      canvas.onpaint = () => {
        ctx.reset();
        ctx.drawElementImage(content, 0, 0);
      };
      const resize = () => {
        canvas.width = Math.max(1, window.innerWidth);
        canvas.height = Math.max(1, window.innerHeight);
        canvas.requestPaint();
      };
      resize();
      window.addEventListener("resize", resize);

      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShaderReady(true));
      });

      return () => {
        window.removeEventListener("resize", resize);
        canvas.onpaint = null;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      // Fallback: show content directly, no shader
      setShaderReady(false);
    }
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {apiSupported ? (
        <>
          {/* The HTMLTexture source: DOM lives inside canvas */}
          <canvas
            ref={canvasRef}
            // @ts-expect-error layoutsubtree is a html-in-canvas attribute
            layoutsubtree="true"
            suppressHydrationWarning
            className="absolute inset-0 h-screen w-screen"
          >
            <div ref={contentRef} className="h-screen w-screen">
              <ProblemContent />
            </div>
          </canvas>
          {/* Postprocessing rain shader on top */}
          {shaderReady && <ShaderCanvas />}
        </>
      ) : (
        // Graceful fallback when browser flag not enabled
        <div className="h-screen w-screen overflow-auto">
          <ProblemContent />
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-black/60 border border-white/20 text-xs text-white/50 font-mono whitespace-nowrap">
            Enable chrome://flags/#canvas-draw-element for the rain effect
          </div>
        </div>
      )}
    </div>
  );
};
