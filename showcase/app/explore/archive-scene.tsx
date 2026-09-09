"use client";

import { CameraControls, Grid } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";

import { ProblemStation } from "./stations/problem-station";
import { MachineStation } from "./stations/machine-station";
import { AnswerStation } from "./stations/answer-station";
import { LanguageFamilyTree } from "./language-family-tree";

export type SceneId = "problem" | "machine" | "answer";

interface ArchiveSceneProps {
  active: SceneId;
}

const STATIONS: Record<
  SceneId,
  {
    position: [number, number, number];
    cameraPosition: [number, number, number];
    target: [number, number, number];
    accent: string;
  }
> = {
  problem: {
    position: [-6.5, 0, -2],
    cameraPosition: [-7, 2.2, 6],
    target: [-6.5, 1.4, -2],
    accent: "#7dd3fc",
  },
  machine: {
    position: [0, 0, -2],
    cameraPosition: [0, 2.2, 6],
    target: [0, 1.35, -2],
    accent: "#e5a84b",
  },
  answer: {
    position: [6.5, 0, -2],
    cameraPosition: [7, 2.2, 6],
    target: [6.5, 1.4, -2],
    accent: "#34d399",
  },
};

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.6} metalness={0.1} />
      </mesh>
      <Grid
        args={[40, 40]}
        position={[0, 0.01, 0]}
        cellSize={0.5}
        sectionSize={2.5}
        cellColor="#1a1f6e"
        sectionColor="#253ddd"
        fadeDistance={25}
        fadeStrength={1.5}
      />
    </>
  );
}

const GLYPHS = ["ã", "ka", "pita", "nhaa", "kuta", "apu", "kaa", "api"];

function createGlyphTexture(glyph: string, color: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, size, size);
  ctx.font = `bold ${size * 0.45}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.05);
  const metrics = ctx.measureText(glyph);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // store aspect on the texture object for sprite scaling
  (tex as any).aspect = metrics.width / (size * 0.45);
  return tex;
}

function FloatingGlyphs({ accent }: { accent: string }) {
  const [sprites] = useState(() =>
    Array.from({ length: 18 }, (_, i) => {
      const glyph = GLYPHS[i % GLYPHS.length];
      return {
        glyph,
        position: [
          (Math.random() - 0.5) * 20,
          1.8 + Math.random() * 4.5,
          (Math.random() - 0.5) * 12 - 3,
        ] as [number, number, number],
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35,
        scale: 0.18 + Math.random() * 0.28,
      };
    }),
  );
  const group = useRef<THREE.Group>(null);
  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    GLYPHS.forEach((g) => map.set(g, createGlyphTexture(g, accent)));
    return map;
  }, [accent]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const s = sprites[i];
      child.position.y = s.position[1] + Math.sin(clock.elapsedTime * s.speed + s.phase) * 0.12;
      child.rotation.z = Math.sin(clock.elapsedTime * s.speed * 0.5 + s.phase) * 0.06;
      const scale = s.scale * (0.85 + Math.sin(clock.elapsedTime * 0.5 + s.phase) * 0.15);
      const tex = textures.get(s.glyph);
      const aspect = tex ? (tex as any).aspect || 1 : 1;
      child.scale.set(scale * aspect, scale, scale);
    });
  });

  return (
    <group ref={group}>
      {sprites.map((s, i) => (
        <sprite key={i} position={s.position}>
          <spriteMaterial
            map={textures.get(s.glyph)}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

function CameraRig({ active }: { active: SceneId }) {
  const cameraControls = useRef<any>(null);
  const reduced = useReducedMotion();
  const station = STATIONS[active];

  useEffect(() => {
    if (!cameraControls.current) return;
    const [x, y, z] = station.cameraPosition;
    const [tx, ty, tz] = station.target;
    cameraControls.current.setLookAt(x, y, z, tx, ty, tz, !reduced);
  }, [active, reduced, station]);

  return <CameraControls ref={cameraControls} makeDefault minDistance={3} maxDistance={14} />;
}

function Scene({ active }: { active: SceneId }) {
  const accent = STATIONS[active].accent;

  return (
    <>
      <color attach="background" args={["#0a0c10"]} />
      <fog attach="fog" args={["#0a0c10", 12, 35]} />

      <ambientLight intensity={0.25} />
      <spotLight
        position={[0, 10, 2]}
        angle={Math.PI / 5}
        penumbra={0.6}
        intensity={80}
        color="#1a1f6e"
        castShadow
      />
      <pointLight position={[-4, 3, 2]} intensity={20} color="#7dd3fc" />
      <pointLight position={[0, 3, 2]} intensity={30} color="#e5a84b" />
      <pointLight position={[4, 3, 2]} intensity={20} color="#34d399" />

      <CameraRig active={active} />
      <Floor />

      <ProblemStation position={STATIONS.problem.position} accent={STATIONS.problem.accent} visible={active === "problem"} />
      <MachineStation position={STATIONS.machine.position} />
      <AnswerStation position={STATIONS.answer.position} accent={STATIONS.answer.accent} visible={active === "answer"} />

      <FloatingGlyphs accent={accent} />
      <LanguageFamilyTree />
    </>
  );
}

export const ArchiveScene = ({ active }: ArchiveSceneProps) => {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 2.2, 5], fov: 50, near: 0.1, far: 100 }}
      className="absolute inset-0"
    >
      <Scene active={active} />
    </Canvas>
  );
};
