"use client";

// ─── MaterialField ─────────────────────────────────────────────────────────────
// Phase 1 material pass for the AmbientWorld backdrop. A field of faint
// hexagonal "glass" cells refracts the puzzle's place-atmosphere (bgTint glow
// rising from the homeland, source-hue zenith wash, slow woven accent bands),
// with chromatic fringing, a pointer-driven specular sweep, and a slow
// breathing lattice. Light behaves, so the world feels material — not paint.
//
// Purely decorative: aria-hidden, pointer-events-none, driven entirely by
// PuzzleTheme colors. Reduced motion freezes time and renders on demand;
// the loop pauses when the tab is hidden; DPR is capped for mobile GPUs.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { PuzzleTheme } from "./puzzle-data";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform vec3 uAccent;
uniform vec3 uBg;
uniform vec3 uSource;
uniform vec2 uLight;     // pointer-driven light direction
uniform float uLightMix; // 0 = static key light .. 1 = pointer light
uniform float uBreath;   // 0 = static lattice .. 1 = breathing cells

const float CELL = 0.052;

// — hex lattice (axial coordinates) —
vec2 hexPixelToAxial(vec2 p, float s) {
  return vec2((0.5773503 * p.x - 0.3333333 * p.y) / s, (0.6666667 * p.y) / s);
}
vec3 cubeRound(vec3 c) {
  float rx = floor(c.x + 0.5), ry = floor(c.y + 0.5), rz = floor(c.z + 0.5);
  float dx = abs(rx - c.x), dy = abs(ry - c.y), dz = abs(rz - c.z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return vec3(rx, ry, rz);
}
vec2 hexAxialRound(vec2 qr) {
  vec3 cube = vec3(qr.x, -qr.x - qr.y, qr.y);
  vec3 rc = cubeRound(cube);
  return vec2(rc.x, rc.z);
}
vec2 hexAxialToPixel(vec2 qr, float s) {
  return vec2(s * (1.7320508 * qr.x + 0.8660254 * qr.y), s * 1.5 * qr.y);
}
float sdHex(vec2 p, float r) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))) - r, p.x - r);
}

// The atmosphere the cells refract: place-glow rising from the bottom edge,
// source-hue zenith wash, slow woven bands in the accent hue.
vec3 atmosphere(vec2 uv) {
  float bottom = smoothstep(0.95, -0.05, uv.y);
  vec3 col = mix(uBg * 0.42, uBg * 1.75, bottom * bottom);
  col += uSource * 0.09 * smoothstep(0.8, 0.0, uv.y);
  float band = sin(uv.y * 46.0 + sin(uv.x * 7.0 + uTime * 0.12) * 1.8 + uTime * 0.05);
  col += uAccent * 0.028 * band * band;
  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // breathing cell lattice
  float breathe = 1.0 + uBreath * 0.05 * sin(uTime * 0.5 + p.y * 2.2 + p.x);
  vec2 pp = p * breathe;
  vec2 qr = hexAxialRound(hexPixelToAxial(pp, CELL));
  vec2 c = hexAxialToPixel(qr, CELL);
  vec2 lp = pp - c;
  float d = sdHex(lp, CELL * 0.92);
  float inside = smoothstep(0.0, 0.0035, -d);
  float rad = clamp(length(lp) / (CELL * 0.95), 0.0, 1.0);
  vec2 n = normalize(lp + 1e-5);

  // refraction of the atmosphere toward each cell centre + chromatic fringing
  float strength = 0.055 * (1.0 - pow(rad, 1.4));
  vec2 refr = n * strength;
  float ca = 0.0035 * (1.0 - rad);
  vec3 glass;
  glass.r = atmosphere(uv + refr * 1.15 + vec2(ca, 0.0)).r;
  glass.g = atmosphere(uv + refr).g;
  glass.b = atmosphere(uv + refr * 0.85 - vec2(ca, 0.0)).b;

  // pointer-driven specular sweep
  vec2 L = normalize(mix(vec2(0.65, 0.85), uLight, uLightMix));
  float spec = pow(max(0.0, dot(L, n)), 18.0) * (1.0 - rad);
  glass += vec3(1.0, 0.96, 0.9) * spec * 0.45;

  vec3 col = mix(atmosphere(uv), glass, inside * 0.9);

  // hairline lattice glow at cell boundaries — the kilim/weave whisper
  float edge = smoothstep(0.0018, 0.0, abs(d));
  col += uAccent * edge * 0.08;

  // gentle vignette to hold the field desk
  float vig = smoothstep(1.3, 0.35, length(p));
  col *= mix(0.82, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function FieldPlane({ theme, reduced }: { theme: PuzzleTheme; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uAccent: { value: new THREE.Color(theme.accent) },
          uBg: { value: new THREE.Color(theme.bgTint ?? theme.accent) },
          uSource: { value: new THREE.Color(theme.sourceColor) },
          uLight: { value: new THREE.Vector2(0.65, 0.85) },
          uLightMix: { value: 0 },
          uBreath: { value: reduced ? 0 : 1 },
        },
        depthWrite: false,
        depthTest: false,
      }),
    [theme, reduced],
  );

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  // Pointer-driven key light (fine pointers only, never under reduced motion)
  const lightTarget = useRef(new THREE.Vector2(0.65, 0.85));
  const lightMixTarget = useRef(0);
  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      lightTarget.current.set(
        (e.clientX / window.innerWidth - 0.5) * 2,
        (0.5 - e.clientY / window.innerHeight) * 2,
      );
      lightMixTarget.current = 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  // Re-render the static frame when reduced motion (demand frameloop)
  useEffect(() => {
    if (reduced) invalidate();
  }, [reduced, mat, invalidate]);

  useFrame((state, delta) => {
    const u = mat.uniforms;
    u.uAspect.value = size.width / Math.max(1, size.height);
    if (!reduced) u.uTime.value = state.clock.elapsedTime;
    const k = 1 - Math.exp(-4 * Math.min(delta, 0.1));
    (u.uLight.value as THREE.Vector2).lerp(lightTarget.current, k);
    u.uLightMix.value += (lightMixTarget.current - u.uLightMix.value) * k;
  });

  return (
    <mesh material={mat} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

export const MaterialField = ({
  theme,
  reduced,
}: {
  theme: PuzzleTheme;
  reduced: boolean;
}) => {
  // Pause the render loop while the tab is hidden (saves mobile battery)
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const still = reduced || hidden;

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={still ? "demand" : "always"}
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 0, 1] }}
      >
        <FieldPlane theme={theme} reduced={reduced} />
      </Canvas>
    </div>
  );
};
