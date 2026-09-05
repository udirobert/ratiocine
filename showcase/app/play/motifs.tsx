"use client";

// ─── Generative cultural motifs ───────────────────────────────────────────────
// Each puzzle world gets an abstract, generative SVG motif inspired by the
// material culture of the language's homeland — never a copied sacred glyph.
// Rendered full-bleed, stroked in the puzzle accent at very low opacity, and
// slowly drifted by CSS (see .motif-drift in globals.css).

import type { ReactNode } from "react";

// Apurinã (Amazonas) — river currents: layered flowing contour lines
const ApurinaMotif = (color: string): ReactNode => {
  const lines: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y0 = 60 + i * 100;
    const amp = 22 + (i % 3) * 12;
    const phase = i * 1.7;
    let d = `M -80 ${y0}`;
    for (let x = -80; x < 1600; x += 100) {
      const yc = y0 + Math.sin(phase + (x + 50) / 180) * amp;
      const ye = y0 + Math.sin(phase + (x + 100) / 180) * amp;
      d += ` Q ${x + 50} ${yc.toFixed(1)} ${x + 100} ${ye.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines.map((d, i) => (
    <path
      key={i}
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={0.12 + (i % 3) * 0.045}
      strokeWidth={1.5}
    />
  ));
};

// Swahili (East African coast) — monsoon swell: concentric arcs rising
// from the bottom corners, like dhow sails and Indian Ocean sets
const SwahiliMotif = (color: string): ReactNode => {
  const arcs: ReactNode[] = [];
  for (let r = 140, k = 0; r <= 1060; r += 100, k++) {
    arcs.push(
      <circle
        key={`l${r}`}
        cx={-40}
        cy={940}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={0.10 + (k % 3) * 0.035}
        strokeWidth={1.5}
      />,
      <circle
        key={`r${r}`}
        cx={1480}
        cy={940}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={0.09 + (k % 3) * 0.03}
        strokeWidth={1.5}
      />,
    );
  }
  return arcs;
};

// Turkish (Türkiye) — kilim lattice: an offset grid of woven diamonds
const TurkishMotif = (color: string): ReactNode => {
  const els: ReactNode[] = [];
  const s = 44; // diamond half-size
  let k = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 13; col++) {
      const x = col * 124 + (row % 2 ? 62 : 0) + 20;
      const y = row * 124 + 44;
      els.push(
        <path
          key={k++}
          d={`M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`}
          fill="none"
          stroke={color}
          strokeOpacity={0.13}
          strokeWidth={1.5}
        />,
      );
      if ((row + col) % 3 === 0) {
        const h = s / 2;
        els.push(
          <path
            key={k++}
            d={`M ${x} ${y - h} L ${x + h} ${y} L ${x} ${y + h} L ${x - h} ${y} Z`}
            fill={color}
            fillOpacity={0.07}
            stroke="none"
          />,
        );
      }
    }
  }
  return els;
};

// Quechua (the Andes) — agricultural terraces: stepped profiles climbing
const QuechuaMotif = (color: string): ReactNode => {
  const els: ReactNode[] = [];
  const step = 15;
  const run = 128;
  for (let i = 0; i < 7; i++) {
    const y0 = 110 + i * 122;
    const dir = i % 2 === 0 ? 1 : -1;
    let d = `M -60 ${y0}`;
    let x = -60;
    let y = y0;
    for (let s = 0; s < 12; s++) {
      x += run;
      d += ` L ${x} ${y}`;
      y += step * dir;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    els.push(
      <path
        key={i}
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={0.12 + (i % 2) * 0.035}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />,
    );
  }
  return els;
};

// Nahuatl (central Mexico) — step-fret meander bands (xicalcoliuhqui-inspired,
// abstracted): continuous hooked step lines in three horizontal bands
const NahuatlMotif = (color: string): ReactNode => {
  const u = 13;
  const meander = (x0: number, y0: number, flip: 1 | -1): string =>
    `M ${x0} ${y0} h ${4 * u} v ${flip * 2 * u} h ${-3 * u} v ${-flip * u} h ${2 * u} v ${flip * u} h ${-u}`;
  const els: ReactNode[] = [];
  let k = 0;
  for (const [bandY, flip] of [[140, 1], [430, -1], [700, 1]] as const) {
    for (let x = -20; x < 1500; x += 4 * u + 26) {
      els.push(
        <path
          key={k++}
          d={meander(x, bandY, flip)}
          fill="none"
          stroke={color}
          strokeOpacity={0.13}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />,
      );
    }
  }
  return els;
};

const BUILDERS: Record<string, (color: string) => ReactNode> = {
  "apurina-verb-agreement": ApurinaMotif,
  "swahili-person-tense": SwahiliMotif,
  "turkish-vowel-harmony": TurkishMotif,
  "quechua-person-endings": QuechuaMotif,
  "nahuatl-both-ends": NahuatlMotif,
};

interface MotifProps {
  puzzleId: string;
  color: string;
  className?: string;
}

export const Motif = ({ puzzleId, color, className }: MotifProps) => {
  const build = BUILDERS[puzzleId] ?? ApurinaMotif;
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {build(color)}
    </svg>
  );
};
