"use client";

import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface BranchProps {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  label: string;
}

function Branch({ start, end, color, label }: BranchProps) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(...start),
        new THREE.Vector3(...end),
      ]),
    [start, end],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 8, 0.045, 8, false),
    [curve],
  );

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>
      <mesh position={end} castShadow receiveShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      <Html position={end} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div className="rounded border border-white/10 bg-[#0a0f2e] px-2.5 py-1 text-center shadow-lg">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/70">
            {label}
          </p>
        </div>
      </Html>
    </group>
  );
}

export function LanguageFamilyTree() {
  const trunkRef = useRef<THREE.Mesh>(null);

  const rings = useMemo(() => {
    const items: { position: [number, number, number]; radius: number; color: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const y = 0.7 + i * 0.85;
      const radius = 0.65 + i * 0.25;
      items.push({
        position: [0, y, 0],
        radius,
        color: i % 2 === 0 ? "#3a2818" : "#2c1e12",
      });
    }
    return items;
  }, []);

  return (
    <group position={[0, 0, -16]}>
      {/* Trunk */}
      <mesh ref={trunkRef} position={[0, 2.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.35, 5, 18]} />
        <meshStandardMaterial
          color="#3b2a1a"
          roughness={0.85}
          metalness={0.15}
          emissive="#1a1205"
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Ringed bark bands */}
      {rings.map((ring, i) => (
        <mesh key={i} position={ring.position} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[ring.radius, 0.04, 6, 40]} />
          <meshStandardMaterial color={ring.color} roughness={0.9} metalness={0.1} />
        </mesh>
      ))}

      {/* Branches */}
      <Branch start={[0, 4.2, 0]} end={[-3.5, 5.2, 2]} color="#7dd3fc" label="Arawakan" />
      <Branch start={[0, 3.8, 0]} end={[3.5, 4.8, 1.5]} color="#e5a84b" label="Tupian" />
      <Branch start={[0, 3.4, 0]} end={[-1.2, 4.5, -2]} color="#34d399" label="Panoan" />
      <Branch start={[0, 4.5, 0]} end={[1.2, 5.3, -1.5]} color="#a78bfa" label="Nuclear-Macro-Jê" />

      {/* Soft backlight so the tree reads through the fog */}
      <pointLight position={[0, 4, 2]} intensity={30} color="#e5a84b" distance={18} decay={2} />
      <pointLight position={[0, 6, -2]} intensity={20} color="#7dd3fc" distance={16} decay={2} />
    </group>
  );
}
