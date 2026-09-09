"use client";

import { Html } from "@react-three/drei";

interface StationLine {
  key: string;
  value: string;
}

interface StationLabelProps {
  title: string;
  lines: StationLine[];
  y?: number;
}

export const StationLabel = ({ title, lines, y = 3.4 }: StationLabelProps) => {
  return (
    <Html position={[0, y, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
      <div className="flex flex-col items-center text-center" style={{ width: "260px" }}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          {title}
        </p>
        <div className="mt-2 rounded-md border border-white/10 bg-[#0a0f2e] px-3 py-2 shadow-lg">
          {lines.map((line) => (
            <p key={line.key} className="text-[11px] leading-relaxed text-white/90">
              <span className="text-white/50">{line.key}:</span> {line.value}
            </p>
          ))}
        </div>
      </div>
    </Html>
  );
};
