"use client";

// ─── AmbientWorld ─────────────────────────────────────────────────────────────
// The living backdrop of a puzzle: deep place-atmosphere from the theme's
// bgTint, a drifting cultural motif, slow aurora light in the accent hue,
// rising embers, pointer parallax (fine pointers only), CRT scan lines carried
// over from the machine scene, and a vignette to hold focus.
// Purely decorative: aria-hidden, pointer-events-none, transform/opacity only.

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

import { Motif } from "./motifs";
import { MaterialField } from "./material-field";
import type { PuzzleTheme } from "./puzzle-data";

interface AmbientWorldProps {
  puzzleId: string;
  theme: PuzzleTheme;
}

// Deterministic pseudo-random (SSR-safe: no Math.random at render time)
const prand = (i: number, n: number): number => {
  const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const AmbientWorld = ({ puzzleId, theme }: AmbientWorldProps) => {
  const reduced = useReducedMotion();

  // WebGL capability — fall back to the painted gradient when unavailable
  const [glOk, setGlOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setGlOk(Boolean(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setGlOk(false);
    }
  }, []);

  // Pointer parallax — normalized -1..1, spring-smoothed
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 38, damping: 16 });
  const sy = useSpring(my, { stiffness: 38, damping: 16 });
  // Back layer (motif) drifts against the cursor; light drifts with it
  const motifX = useTransform(sx, (v) => v * -18);
  const motifY = useTransform(sy, (v) => v * -12);
  const lightX = useTransform(sx, (v) => v * 26);
  const lightY = useTransform(sy, (v) => v * 18);

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, reduced]);

  const embers = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: 4 + prand(i, 1) * 92,
        offset: prand(i, 2) * 40,
        size: 1.5 + prand(i, 3) * 2.5,
        duration: 17 + prand(i, 4) * 14,
        delay: -prand(i, 5) * 30,
        peak: 0.22 + prand(i, 6) * 0.28,
        sway: `${(prand(i, 7) - 0.5) * 8}vw`,
      })),
    [],
  );

  // Staggered entrance choreography — the field desk assembles itself.
  // Layers: material → motif → aurora → embers. Skipped under reduced motion.
  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 1.4, delay, ease: "easeOut" as const },
        };

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {/* Living material field — hex glass cells refracting the place-atmosphere
          (shader; falls back to the painted gradient without WebGL) */}
      <motion.div className="absolute inset-0" {...enter(0)}>
        {glOk === false ? (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 120% 90% at 50% 108%, ${theme.bgTint ?? theme.accent}b3 0%, transparent 62%), radial-gradient(ellipse 90% 70% at 50% -20%, ${theme.bgTint ?? theme.accent}66 0%, transparent 55%)`,
            }}
          />
        ) : (
          <MaterialField theme={theme} reduced={Boolean(reduced)} />
        )}
      </motion.div>

      {/* Cultural motif — slow drift + counter-parallax; lines draw on like ink */}
      <motion.div
        style={reduced ? undefined : { x: motifX, y: motifY }}
        className="absolute -inset-14"
        {...enter(0.45)}
      >
        <Motif
          puzzleId={puzzleId}
          color={theme.accent}
          className="motif-drift w-full h-full"
        />
      </motion.div>

      {/* Aurora light — two slow breaths in accent & source hues */}
      <motion.div
        style={reduced ? undefined : { x: lightX, y: lightY }}
        className="absolute inset-0"
        {...enter(1.05)}
      >
        <div
          className="aurora-a absolute -left-1/4 top-1/4 h-[60vmax] w-[60vmax] rounded-full opacity-[0.13] blur-3xl"
          style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 65%)` }}
        />
        <div
          className="aurora-b absolute -right-1/4 -bottom-1/6 h-[55vmax] w-[55vmax] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: `radial-gradient(circle, ${theme.sourceColor} 0%, transparent 65%)` }}
        />
      </motion.div>

      {/* Embers — faint motes of the accent hue rising through the air */}
      {!reduced &&
        embers.map((e, i) => (
          <span
            key={i}
            className="ember absolute rounded-full"
            style={{
              left: `${e.left}%`,
              bottom: `-${e.offset}px`,
              width: e.size,
              height: e.size,
              backgroundColor: theme.accent,
              opacity: 0,
              ["--peak" as string]: e.peak,
              ["--sway" as string]: e.sway,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}

      {/* CRT scan lines + grain — the machine is still with you */}
      <div
        className="absolute inset-0 opacity-[0.014]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.012] grain-noise" />

      {/* Vignette — hold focus at the center of the field desk */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 85% at 50% 45%, transparent 58%, rgba(0,0,0,0.34) 100%)",
        }}
      />
    </div>
  );
};
