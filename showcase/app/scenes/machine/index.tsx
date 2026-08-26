"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { drawScreen, setSkipTypewriter, setSolvedState, SCREEN_H, SCREEN_W } from "./screen-canvas";
import type { SolvedData } from "./screen-canvas";
import { useSolveCounter } from "../../play/use-solve-counter";

const MacScene = dynamic(
  () => import("./mac-scene").then((m) => m.MacScene),
  { ssr: false },
);

interface MachineProps {
  onPlay?: () => void;
  zooming?: boolean;
  solvedResult?: SolvedData | null;
}

export const Machine = ({ onPlay, zooming = false, solvedResult = null }: MachineProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { count } = useSolveCounter();

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    // Skip typewriter for return visitors
    const visited = localStorage.getItem("ration-visited");
    if (visited) {
      setSkipTypewriter(true);
    } else {
      localStorage.setItem("ration-visited", "1");
    }
  }, []);

  // Set solved state on CRT when game is complete
  useEffect(() => {
    setSolvedState(solvedResult);
  }, [solvedResult]);

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

      {/* 3D Mac (desktop only) — the machine itself is the play button */}
      {!isMobile && (
        <div
          className="absolute inset-0 cursor-pointer"
          role={onPlay ? "button" : undefined}
          aria-label={onPlay ? "Play today's puzzle" : undefined}
          onClick={() => { if (!zooming) onPlay?.(); }}
        >
          <MacScene screenCanvasRef={canvasRef} zooming={zooming} />
        </div>
      )}

      {/* Play button — positioned below the Mac (hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="absolute inset-x-0 bottom-16 z-30 flex flex-col items-center gap-2 pointer-events-none">
          {onPlay ? (
            <button
              onClick={onPlay}
              className="pointer-events-auto px-7 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 backdrop-blur text-amber-300 font-mono text-sm font-medium hover:bg-amber-400/20 hover:border-amber-400/60 transition-all shadow-[0_0_20px_rgba(229,168,75,0.1)]"
            >
              ▶ Play today&rsquo;s puzzle
            </button>
          ) : (
            <Link
              href="/play"
              className="pointer-events-auto px-7 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 backdrop-blur text-amber-300 font-mono text-sm font-medium hover:bg-amber-400/20 hover:border-amber-400/60 transition-all shadow-[0_0_20px_rgba(229,168,75,0.1)]"
            >
              ▶ Play today&rsquo;s puzzle
            </Link>
          )}
          <span className="font-mono text-[10px] text-white/30">or click the machine — new puzzle daily</span>
        </div>
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
          <p className="mt-3 font-mono text-[11px] text-white/45">
            A new puzzle every day.
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

      {/* Footer hints (desktop only, hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-1">
          {count !== null && count > 0 && (
            <p className="text-[10px] text-white/40 font-mono">
              {count} solved today
            </p>
          )}
          <p className="text-[10px] text-white/25 font-mono">
            drag to rotate
          </p>
        </div>
      )}
    </div>
  );
};
