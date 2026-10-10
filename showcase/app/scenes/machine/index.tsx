"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../../components/button";
import { MacLoading } from "./mac-loading";
import { drawScreen, setSkipTypewriter, setSolvedState, SCREEN_H, SCREEN_W } from "./screen-canvas";
import type { SolvedData } from "./screen-canvas";
import { useSolveCounter } from "../../play/use-solve-counter";

const MacScene = dynamic(
  () => import("./mac-scene").then((m) => m.MacScene),
  { ssr: false, loading: () => <MacLoading /> },
);

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <path d="M3 1.7v8.6c0 .8.9 1.3 1.6.9l6.9-4.3c.6-.4.6-1.4 0-1.8L4.6.8c-.7-.4-1.6.1-1.6.9z" />
  </svg>
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
          aria-hidden="true"
          className="absolute -left-[9999px] -top-[9999px]"
        />
      )}

      {/* 3D Mac (desktop only) — pure exploration. OrbitControls rotate/orbit;
          it is NOT a play trigger. The dedicated Play button starts the game. */}
      {!isMobile && (
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="3D Macintosh showing today's puzzle"
        >
          <MacScene screenCanvasRef={canvasRef} zooming={zooming} />
        </div>
      )}

      {/* Play button — positioned below the Mac (hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 pointer-events-none">
          {onPlay ? (
            <Button
              variant="primary"
              size="lg"
              onClick={onPlay}
              className="pointer-events-auto pulse-glow"
            >
              <PlayIcon /> Play today&rsquo;s puzzle
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              href="/play"
              className="pointer-events-auto pulse-glow"
            >
              <PlayIcon /> Play today&rsquo;s puzzle
            </Button>
          )}
          <span className="font-mono text-[11px] text-white/55">new puzzle daily</span>
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
          <p className="mt-3 font-mono text-[11px] text-white/55">
            A new puzzle every day.
          </p>
          <Button variant="primary" size="lg" href="/play" className="mt-8">
            Play <PlayIcon />
          </Button>
          <p className="mt-6 font-mono text-[11px] text-white/55 uppercase tracking-widest">
            IOL-AI 2026 Competitor · Score{" "}
            <span className="text-emerald-400/80">0.1141</span>
          </p>
        </div>
      )}

      {/* Footer hints (desktop only, hidden during zoom) */}
      {!isMobile && !zooming && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-1">
          {count !== null && count > 0 && (
            <p className="text-[11px] text-white/55 font-mono">
              {count} solved today
            </p>
          )}
          <p className="text-[11px] text-white/55 font-mono">
            drag to rotate
          </p>
        </div>
      )}
    </div>
  );
};
