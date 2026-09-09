"use client";

import { Html } from "@react-three/drei";

import { PAIRS, QUERIES } from "@/app/scenes/problem/problem-content";

interface ProblemStationProps {
  position: [number, number, number];
  accent?: string;
  visible?: boolean;
}

export const ProblemStation = ({
  position,
  accent = "#7dd3fc",
  visible = true,
}: ProblemStationProps) => {
  if (!visible) return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 1.2, 32]} />
        <meshStandardMaterial color="#10131a" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 1.2, 32]} />
        <meshStandardMaterial color="#10131a" roughness={0.3} metalness={0.7} />
      </mesh>

      <Html
        position={[0, 1.4, 0]}
        distanceFactor={8}
        center
        style={{
          width: "360px",
          pointerEvents: "auto",
        }}
      >
        <div className="rounded-xl border border-white/10 bg-[#0a0f2e] p-5 text-left shadow-2xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
            IOL-AI 2026 · field notebook
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-white">
            Apurinã — Verb Agreement
          </h2>
          <p className="mt-1 font-mono text-xs text-white/40">apu · Arawakan</p>

          <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-white/5">
                {PAIRS.slice(0, 6).map(([n, apu, eng]) => (
                  <tr key={n} className="bg-white/[0.02]">
                    <td className="w-6 py-1.5 pl-2 font-mono text-[10px] text-white/40">
                      {n}
                    </td>
                    <td className="py-1.5 pr-3 font-mono" style={{ color: accent }}>
                      {apu}
                    </td>
                    <td className="py-1.5 pr-2 text-white/80">{eng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1">
            {QUERIES.map((q, i) => (
              <p key={i} className="text-xs text-white/70">
                <span className="font-mono text-white/40">{i + 1}.</span> {q}
              </p>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
};
