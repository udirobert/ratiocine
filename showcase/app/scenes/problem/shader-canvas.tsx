"use client";

import { EffectComposer } from "@react-three/postprocessing";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { RainEffect } from "./shaders/rain";

const RainPass = () => {
  const effect = useMemo(() => new RainEffect(), []);
  return (
    <EffectComposer>
      <primitive object={effect} />
    </EffectComposer>
  );
};

export const ShaderCanvas = () => (
  <Canvas
    className="absolute inset-0 pointer-events-none!"
    style={{ position: "absolute", inset: 0 }}
    gl={{ antialias: false }}
  >
    <RainPass />
  </Canvas>
);
