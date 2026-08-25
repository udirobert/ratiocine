"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import { drawScreen, SCREEN_H, SCREEN_W } from "./screen-canvas";

const MacScene = dynamic(
  () => import("./mac-scene").then((m) => m.MacScene),
  { ssr: false },
);

export const Machine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Drive the typewriter animation on a 2D canvas,
  // then let MacScene sample it as a CanvasTexture.
  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const step = () => {
      drawScreen(ctx, 0, 0);
      raf = requestAnimationFrame(step);
    };

    drawScreen(ctx, 0, 0);
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [isMobile]);

  // Desktop zoom transition: zoom camera → fade overlay → navigate
  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (zooming) return;

    setZooming(true);

    // Start overlay fade at 400ms (halfway through 800ms zoom)
    setTimeout(() => {
      setOverlayOpacity(1);
    }, 400);

    // Navigate after overlay is opaque (800ms total)
    setTimeout(() => {
      router.push("/play");
    }, 850);
  }, [zooming, router]);

  return (
    <div className="scene-stage">
      {/* offscreen 2D canvas sampled by the 3D Mac screen */}
      {!isMobile && (
        <canvas
          ref={canvasRef}
          width={SCREEN_W}
          height={SCREEN_H}
          className="absolute -left-[9999px] -top-[9999px]"
        />
      )}

      {/* 3D Mac (desktop only) */}
      {!isMobile && <MacScene screenCanvasRef={canvasRef} zooming={zooming} />}

      {/* Play link — positioned below the Mac (hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center pointer-events-none">
          <a
            href="/play"
            onClick={handlePlay}
            className="pointer-events-auto px-7 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 backdrop-blur text-amber-300 font-mono text-sm font-medium hover:bg-amber-400/20 hover:border-amber-400/60 transition-all shadow-[0_0_20px_rgba(229,168,75,0.1)]"
          >
            ▶ Play the Apurinã puzzle
          </a>
        </div>
      )}

      {/* Dark overlay — fades in during zoom to mask route transition */}
      {!isMobile && (
        <motion.div
          className="absolute inset-0 z-50 pointer-events-none bg-[#0a0c10]"
          initial={{ opacity: 0 }}
          animate={{ opacity: overlayOpacity }}
          transition={{ duration: 0.4, ease: "easeIn" }}
        />
      )}

      {/* Mobile fallback — minimal splash, no 3D */}
      {isMobile && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            ratiocine
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            Crack the pattern of a real language.
            <br />
            Then watch the machine try.
          </p>
          <Link
            href="/play"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-7 py-3 text-sm font-bold text-black transition-all hover:bg-amber-400"
          >
            Play →
          </Link>
          <p className="mt-6 font-mono text-[10px] text-white/45 uppercase tracking-widest">
            IOL-AI 2026 Competitor · Score{" "}
            <span className="text-emerald-400/80">0.1141</span>
          </p>
        </div>
      )}

      {/* Subtle instruction (desktop only, hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center">
          <p className="text-[10px] text-white/35 font-mono">
            drag to rotate
          </p>
        </div>
      )}
    </div>
  );
};
