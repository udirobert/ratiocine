"use client";

import { CameraControls, Grid } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";

import { ProblemStation } from "./stations/problem-station";
import { MachineStation } from "./stations/machine-station";
import { AnswerStation } from "./stations/answer-station";

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
    position: [-5.5, 0, -2],
    cameraPosition: [-6, 2.2, 5.5],
    target: [-5.5, 1.4, -2],
    accent: "#7dd3fc",
  },
  machine: {
    position: [0, 0, -2],
    cameraPosition: [0, 2.2, 5.5],
    target: [0, 1.5, -2],
    accent: "#e5a84b",
  },
  answer: {
    position: [5.5, 0, -2],
    cameraPosition: [6, 2.2, 5.5],
    target: [5.5, 1.4, -2],
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

function DustMotes({ accent }: { accent: string }) {
  const [geometry] = useState(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = Math.random() * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  });
  const points = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (!points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.015;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={accent}
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.25}
        depthWrite={false}
      />
    </points>
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

      <DustMotes accent={accent} />
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
