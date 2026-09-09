"use client";

import { Html } from "@react-three/drei";

import {
  APURINA_ANSWERS,
  APURINA_REASONING,
} from "@/app/scenes/answer/index";
import { StationLabel } from "./station-label";

interface AnswerStationProps {
  position: [number, number, number];
  accent?: string;
  visible?: boolean;
}

export const AnswerStation = ({
  position,
  accent = "#34d399",
  visible = true,
}: AnswerStationProps) => {
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
        <div className="rounded-xl border border-white/10 bg-[#0a1210] p-5 text-left shadow-2xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
            IOL-AI 2026 · decoded inscription
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-white">
            The Answer
          </h2>
          <p className="mt-1 text-xs text-white/70">
            The model decoded Apurinã&apos;s morphology.
          </p>

          <div className="mt-3 space-y-1.5">
            {APURINA_ANSWERS.map(([n, q, ans]) => (
              <div
                key={n}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="font-mono text-[10px] text-white/40">{n}</span>
                <span className="flex-1 text-xs text-white/70">{q}</span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: accent }}
                >
                  {ans}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-[#0a0f2e]/60 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/45">
              Here&apos;s how
            </p>
            <ul className="mt-1.5 space-y-1 text-[11px] text-white/70">
              {APURINA_REASONING.map(({ label, morphemes, meaning }) => (
                <li key={label}>
                  <span className="text-white/50">{label}</span>{" "}
                  <span className="font-mono">{morphemes}</span> = {meaning}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Html>

      <StationLabel
        title="Verified record"
        lines={[
          { key: "Source", value: "IOL-AI 2026 Apurinã verb agreement" },
          { key: "Method", value: "14B comparative engine + in-canister proof" },
          { key: "Score", value: "0.1141 public · EM=0.0563 chrF=0.2314" },
          { key: "Receipt", value: "ratiocine ledger (mainnet canister)" },
        ]}
      />
    </group>
  );
};
