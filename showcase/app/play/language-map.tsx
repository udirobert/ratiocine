"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { PuzzleProgress } from "./puzzle-data";

// ─── Minimal SVG world map paths (simplified continents) ─────────────────────
// These are deliberately low-detail — the map is atmospheric, not geographic.

const CONTINENTS = [
  // North America
  "M 45 55 L 50 45 L 65 42 L 75 38 L 82 42 L 85 50 L 78 58 L 70 62 L 60 65 L 52 60 Z",
  // South America
  "M 68 68 L 75 65 L 80 70 L 82 80 L 78 92 L 72 98 L 65 95 L 63 85 L 65 75 Z",
  // Europe
  "M 115 38 L 122 35 L 130 37 L 128 42 L 135 44 L 130 48 L 120 46 L 115 42 Z",
  // Africa
  "M 112 55 L 120 52 L 130 55 L 135 62 L 132 72 L 125 80 L 118 78 L 112 70 L 110 62 Z",
  // Asia
  "M 135 32 L 150 28 L 170 30 L 182 35 L 185 45 L 178 52 L 165 55 L 150 52 L 140 48 L 135 40 Z",
  // Oceania
  "M 168 72 L 178 68 L 185 72 L 183 78 L 175 80 L 168 76 Z",
];

interface Pin {
  languageCode: string;
  language: string;
  coordinates: [number, number]; // lat, lng
  current?: boolean; // the one just solved
}

// Known pins (from puzzle pool + current)
const ALL_PINS: Pin[] = [
  { languageCode: "apu", language: "Apurinã", coordinates: [-6.73, -64.45] },
  // Future puzzles would add here
];

// Convert lat/lng to SVG x/y (equirectangular projection, 230×130 viewbox)
function geoToSvg(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 230;
  const y = ((90 - lat) / 180) * 130;
  return [x, y];
}

interface LanguageMapProps {
  progress: PuzzleProgress | null;
  currentLanguageCode: string;
  currentCoordinates: [number, number];
  currentLanguage: string;
}

export const LanguageMap = ({
  progress,
  currentLanguageCode,
  currentCoordinates,
  currentLanguage,
}: LanguageMapProps) => {
  const pins = useMemo(() => {
    const cracked = new Set(progress?.languagesCracked ?? []);
    // Always include current as active
    cracked.add(currentLanguageCode);

    return ALL_PINS.filter((p) => cracked.has(p.languageCode)).map((p) => ({
      ...p,
      current: p.languageCode === currentLanguageCode,
    }));
  }, [progress, currentLanguageCode]);

  const [cx, cy] = geoToSvg(currentCoordinates[0], currentCoordinates[1]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
          Language Map
        </p>
        <p className="font-mono text-[10px] text-white/25">
          {pins.length} pinned
        </p>
      </div>

      {/* SVG Map */}
      <div className="relative px-3 py-4">
        <svg
          viewBox="0 0 230 130"
          className="w-full h-auto max-h-[180px]"
          aria-label="World map showing languages you've decoded"
        >
          {/* Graticule (grid lines) */}
          {[0, 30, 60, 90, 120, 150, 180, 210].map((x) => (
            <line
              key={`v${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={130}
              stroke="white"
              strokeOpacity={0.03}
              strokeWidth={0.3}
            />
          ))}
          {[0, 26, 52, 78, 104, 130].map((y) => (
            <line
              key={`h${y}`}
              x1={0}
              y1={y}
              x2={230}
              y2={y}
              stroke="white"
              strokeOpacity={0.03}
              strokeWidth={0.3}
            />
          ))}

          {/* Continents */}
          {CONTINENTS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="white"
              fillOpacity={0.04}
              stroke="white"
              strokeOpacity={0.08}
              strokeWidth={0.4}
            />
          ))}

          {/* Pins */}
          {pins.map((pin) => {
            const [px, py] = geoToSvg(pin.coordinates[0], pin.coordinates[1]);
            return (
              <g key={pin.languageCode}>
                {pin.current && (
                  <>
                    {/* Pulse ring for current */}
                    <circle
                      cx={px}
                      cy={py}
                      r={5}
                      fill="none"
                      stroke="#e5a84b"
                      strokeWidth={0.4}
                      opacity={0.4}
                    >
                      <animate
                        attributeName="r"
                        from="3"
                        to="8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.5"
                        to="0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Connection line from label */}
                    <line
                      x1={px}
                      y1={py}
                      x2={px + 12}
                      y2={py - 8}
                      stroke="#e5a84b"
                      strokeWidth={0.3}
                      strokeOpacity={0.5}
                    />
                    <text
                      x={px + 13}
                      y={py - 9}
                      fontSize={3.5}
                      fill="#e5a84b"
                      opacity={0.8}
                      fontFamily="monospace"
                    >
                      {pin.language}
                    </text>
                  </>
                )}
                {/* Pin dot */}
                <circle
                  cx={px}
                  cy={py}
                  r={pin.current ? 2.2 : 1.5}
                  fill={pin.current ? "#e5a84b" : "#7ebd6a"}
                  opacity={pin.current ? 1 : 0.7}
                />
              </g>
            );
          })}

          {/* Equator label */}
          <text
            x={2}
            y={67}
            fontSize={2.5}
            fill="white"
            opacity={0.1}
            fontFamily="monospace"
          >
            0°
          </text>
        </svg>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/5 text-center">
        <p className="text-[10px] text-white/30">
          📍 {currentLanguage} — {currentCoordinates[0].toFixed(1)}°{currentCoordinates[0] >= 0 ? "N" : "S"},{" "}
          {Math.abs(currentCoordinates[1]).toFixed(1)}°{currentCoordinates[1] >= 0 ? "E" : "W"}
        </p>
      </div>
    </motion.div>
  );
};
