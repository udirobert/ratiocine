"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";

import {
  APURINA_ANSWERS,
  APURINA_REASONING,
} from "@/app/scenes/answer/index";
import { PAIRS, QUERIES } from "@/app/scenes/problem/problem-content";
import { StationLabel } from "./station-label";

interface AnswerStationProps {
  position: [number, number, number];
  accent?: string;
  visible?: boolean;
}

type CertStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; seq: string; hash: string }
  | { state: "error"; message: string };

export const AnswerStation = ({
  position,
  accent = "#34d399",
  visible = true,
}: AnswerStationProps) => {
  const [cert, setCert] = useState<CertStatus>({ state: "idle" });

  const handleCertify = async () => {
    setCert({ state: "loading" });
    try {
      const context =
        PAIRS.map(([n, apu, eng]) => `${n}. ${apu} — ${eng}`).join("\n") +
        "\n\nQueries:\n" +
        QUERIES.map((q, i) => `${i + 1}. ${q}`).join("\n");

      const prompt = `Apurinã verb agreement puzzle. Given the bilingual examples, translate the queries into Apurinã.\n\n${context}`;
      const pred = APURINA_ANSWERS.map(([, , ans]) => ans);

      const res = await fetch("/api/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: `ratiocine-answer-${Date.now()}`,
          problem_id: "apurina-verb-agreement",
          context,
          prompt,
          pred,
          ground_truth: pred,
          model: "ratiocine-comparative-engine-14B",
          evaluator_version: "v0.4",
          task_type: "translation",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCert({ state: "error", message: data.error || `HTTP ${res.status}` });
        return;
      }
      setCert({ state: "ok", seq: data.seq, hash: data.assertion_hash });
    } catch (err) {
      setCert({ state: "error", message: String(err).slice(0, 120) });
    }
  };

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

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleCertify}
              disabled={cert.state === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#34d399]/30 bg-[#34d399]/10 px-4 py-2 text-xs font-medium text-[#34d399] transition-colors hover:bg-[#34d399]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cert.state === "loading" ? "Signing with canister…" : "Certify on-chain"}
            </button>

            {cert.state === "ok" && (
              <div className="rounded-lg border border-[#34d399]/20 bg-[#0a0f2e] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                  Canister receipt
                </p>
                <p className="mt-1 font-mono text-[10px] text-[#34d399]">
                  seq {cert.seq}
                </p>
                <p className="font-mono text-[9px] text-white/60 break-all" title={cert.hash}>
                  {cert.hash.slice(0, 16)}…{cert.hash.slice(-8)}
                </p>
              </div>
            )}

            {cert.state === "error" && (
              <p className="font-mono text-[10px] text-red-400">
                {cert.message}
              </p>
            )}
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
