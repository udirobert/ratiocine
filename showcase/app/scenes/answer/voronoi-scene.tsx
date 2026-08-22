"use client";

import { Center, Environment, Text3D } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// ─── Voronoi helpers (same algorithm as reference) ───────────────────────────

type P2 = [number, number];

function clipHalf(poly: P2[], mx: number, my: number, nx: number, ny: number): P2[] {
  if (!poly.length) return [];
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a[0] - mx) * nx + (a[1] - my) * ny;
    const db = (b[0] - mx) * nx + (b[1] - my) * ny;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

function voronoiCell(seeds: P2[], i: number, hw: number, hh: number): P2[] {
  const [sx, sy] = seeds[i];
  let poly: P2[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  for (let j = 0; j < seeds.length; j++) {
    if (j === i || !poly.length) continue;
    const [ox, oy] = seeds[j];
    poly = clipHalf(poly, (sx + ox) / 2, (sy + oy) / 2, sx - ox, sy - oy);
  }
  return poly;
}

function polyCenter(poly: P2[]): P2 {
  let x = 0, y = 0;
  for (const [px, py] of poly) { x += px; y += py; }
  return [x / poly.length, y / poly.length];
}

function cellGeo(poly: P2[], cx: number, cy: number, hw: number, hh: number, depth: number): THREE.BufferGeometry {
  const halfD = depth / 2;
  const n = poly.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const [x, y] of poly) {
    pos.push(x - cx, y - cy, halfD);
    uv.push((x + hw) / (2 * hw), (y + hh) / (2 * hh));
  }
  for (const [x, y] of poly) {
    pos.push(x - cx, y - cy, -halfD);
    uv.push((x + hw) / (2 * hw), (y + hh) / (2 * hh));
  }
  for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
  for (let i = 1; i < n - 1; i++) idx.push(n, n + i + 1, n + i);
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n, a2 = a + n, b2 = b + n;
    idx.push(a, b, b2, a, b2, a2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ─── Fragment data ────────────────────────────────────────────────────────────

interface Frag {
  geo: THREE.BufferGeometry;
  x0: number; y0: number;
  sx: number; sy: number;
  rx: number; ry: number; rz: number;
}

const PLANE_W = 1.6;
const PLANE_H = 1.0;
const SEED_COUNT = 80;
// "assemble" animation: fragments start spread out and converge inward
const START_RADIUS = 1.5;
const ASSEMBLE_TIME = 1.6;
const FRAG_DEPTH = 0.025;

// ─── 3D answer text ───────────────────────────────────────────────────────────

const AnswerText = ({ active }: { active: boolean }) => {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    if (!active) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    // scale in, then hold
    group.current.scale.setScalar(
      THREE.MathUtils.damp(group.current.scale.x, 1, 4, delta),
    );
    // lock into a settled pose (no endless spin): ease a breath of rotation
    const settle = 1 - Math.exp(-t * 2.2);
    group.current.rotation.z = (Math.PI / 2 - 0.32) * settle + 0.12 * Math.sin(t * 1.2);
    group.current.rotation.y = 0.22 * settle + 0.05 * Math.sin(t * 0.8);
    group.current.rotation.x = 0.06 * Math.sin(t * 1.7);
    group.current.position.y = 0.03 + 0.03 * Math.sin(t * 1.1);
  });

  if (!active) return null;

  return (
    <group ref={group} scale={0.01}>
      <Center>
        <group>
          {["kaakutaka", "(we eat)"].map((line, i) => (
            <Center key={i} position={[0, i === 0 ? 0.08 : -0.1, 0]} disableY>
              <Text3D
                font="/inter.json"
                size={i === 0 ? 0.12 : 0.055}
                height={0.02}
                bevelEnabled
                bevelSize={0.002}
                bevelThickness={0.003}
                bevelSegments={4}
                curveSegments={8}
              >
                {line}
                <meshStandardMaterial
                  color={i === 0 ? "#7dd3fc" : "#94a3b8"}
                  metalness={0.8}
                  roughness={0.2}
                />
              </Text3D>
            </Center>
          ))}
        </group>
      </Center>
    </group>
  );
};

// ─── Assemble mesh ────────────────────────────────────────────────────────────

const VoronoiExplosion = ({
  canvasEl,
  active,
}: {
  canvasEl: HTMLCanvasElement | null;
  active: boolean;
}) => {
  const t0 = useRef<number | null>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const { frags, canvasTex, mat } = useMemo(() => {
    const canvasTex = canvasEl ? new THREE.CanvasTexture(canvasEl) : null;
    if (canvasTex) canvasTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: canvasTex,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      roughness: 0.1,
      metalness: 0.3,
      envMapIntensity: 1.2,
    });

    const hw = PLANE_W / 2;
    const hh = PLANE_H / 2;
    const seeds: P2[] = Array.from({ length: SEED_COUNT }, () => [
      (Math.random() - 0.5) * 0.92 * PLANE_W,
      (Math.random() - 0.5) * 0.92 * PLANE_H,
    ]);

    const frags: Frag[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const poly = voronoiCell(seeds, i, hw, hh);
      if (poly.length < 3) continue;
      const [cx, cy] = polyCenter(poly);
      const geo = cellGeo(poly, cx, cy, hw, hh, FRAG_DEPTH);
      const dist = Math.hypot(cx, cy);
      const base = dist < 1e-4 ? Math.random() * Math.PI * 2 : Math.atan2(cy, cx);
      const jitter = (Math.random() - 0.5) * 1.1;
      // each fragment starts scattered outward, then converges to its home cell
      const spread = START_RADIUS + Math.random() * 0.8;
      frags.push({
        geo, x0: cx, y0: cy,
        sx: Math.cos(base + jitter) * spread,
        sy: Math.sin(base + jitter) * spread,
        rx: (Math.random() - 0.5) * 1.2,
        ry: (Math.random() - 0.5) * 1.2,
        rz: (Math.random() - 0.5) * 1.6,
      });
    }
    return { frags, canvasTex, mat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl]);

  useFrame(() => {
    if (!active) return;
    if (t0.current === null) t0.current = performance.now();
    const t = (performance.now() - t0.current) / 1000;
    if (canvasTex) canvasTex.needsUpdate = true;
    // ease the fragments together (assemble), then settle
    const p = Math.min(t / ASSEMBLE_TIME, 1);
    const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
    mat.opacity = Math.min(1, p * 2); // fade in as pieces arrive
    frags.forEach((f, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;
      mesh.position.set(
        f.sx + (f.x0 - f.sx) * ease,
        f.sy + (f.y0 - f.sy) * ease,
        0,
      );
      mesh.rotation.set(f.rx * (1 - ease), f.ry * (1 - ease), f.rz * (1 - ease));
    });
  });

  useEffect(() => () => {
    frags.forEach((f) => f.geo.dispose());
    mat.dispose();
    canvasTex?.dispose();
  }, [frags, canvasTex, mat]);

  if (!active) return null;
  return (
    <>
      {frags.map((f, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          geometry={f.geo}
          material={mat}
          position={[f.sx, f.sy, 0]}
          renderOrder={999}
        />
      ))}
    </>
  );
};

// ─── Static answer plane ──────────────────────────────────────────────────────

const AnswerPlane = ({
  canvasEl,
}: {
  canvasEl: HTMLCanvasElement | null;
}) => {
  const { mat, tex } = useMemo(() => {
    const tex = canvasEl ? new THREE.CanvasTexture(canvasEl) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
    });
    return { mat, tex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl]);

  useFrame(() => {
    if (tex) tex.needsUpdate = true;
  });

  useEffect(() => () => { mat.dispose(); tex?.dispose(); }, [mat, tex]);

  return (
    <mesh material={mat}>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
    </mesh>
  );
};

// ─── Full scene ───────────────────────────────────────────────────────────────

interface VoronoiSceneProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  exploded: boolean;
}

export const VoronoiScene = ({ canvasRef, exploded }: VoronoiSceneProps) => {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setEl(canvasRef.current));
  }, [canvasRef]);

  return (
    <div className={exploded ? "absolute inset-0 cursor-grab active:cursor-grabbing" : "pointer-events-none absolute inset-0"}>
      <Canvas
        dpr={2}
        gl={{ powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
        camera={{ near: 0.01, far: 20, position: [0, 0, 1.5], fov: 50 }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>
        {!exploded && el && <AnswerPlane canvasEl={el} />}
        <VoronoiExplosion canvasEl={el} active={exploded} />
        <AnswerText active={exploded} />
      </Canvas>
    </div>
  );
};
