"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import { MacModel } from "@/app/scenes/machine/mac-model";
import { StationLabel } from "./station-label";

const SCREEN_W = 562;
const SCREEN_H = 408;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawStaticScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = 0; y < SCREEN_H; y += 3) {
    ctx.fillRect(0, y, SCREEN_W, 1);
  }

  const centerX = SCREEN_W / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillText("ratiocine", centerX, 145);

  ctx.font = "15px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("comparative engine", centerX, 205);
  ctx.fillText("14B parameters · in-canister proof", centerX, 228);

  ctx.strokeStyle = "rgba(229, 168, 75, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(ctx, centerX - 60, 285 - 16, 120, 32, 16);
  ctx.stroke();
  ctx.fillStyle = "rgba(229, 168, 75, 0.08)";
  ctx.fill();

  ctx.font = "bold 13px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(229, 168, 75, 0.9)";
  ctx.fillText("▶  R U N", centerX, 285);

  ctx.font = "9px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("IOL-AI 2026 Competitor · Score 0.1141", centerX, SCREEN_H - 30);
}

interface MachineStationProps {
  position: [number, number, number];
}

export const MachineStation = ({ position }: MachineStationProps) => {
  const [screenCanvas, setScreenCanvas] = useState<HTMLCanvasElement | null>(null);
  const drawn = useRef(false);

  useEffect(() => {
    if (drawn.current || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawStaticScreen(ctx);
      drawn.current = true;
    }
    setScreenCanvas(canvas);
  }, []);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[1.2, 1.35, 0.9, 48]} />
        <meshStandardMaterial color="#10131a" roughness={0.3} metalness={0.7} emissive="#1a1205" emissiveIntensity={0.2} />
      </mesh>

      <pointLight position={[0, 2.5, 1.5]} intensity={25} color="#e5a84b" distance={8} />
      <pointLight position={[0, 0.6, 1.2]} intensity={12} color="#e5a84b" distance={4} />

      <group position={[0, 0.95, 0]} scale={[2.8, 2.8, 2.8]}>
        <Suspense fallback={null}>
          <MacModel screenCanvas={screenCanvas} enableFloat={false} />
        </Suspense>
      </group>

      <StationLabel
        title="Brass-and-glass analyzer"
        lines={[
          { key: "Model", value: "14B comparative engine" },
          { key: "Runtime", value: "Modal L4 worker" },
          { key: "Verifier", value: "Neutron canister (EM + chrF)" },
          { key: "Mode", value: "Greedy decode · 512 tokens" },
        ]}
      />
    </group>
  );
};
