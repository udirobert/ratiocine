"use client";

import { Float } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { CanvasTexture, Mesh, SRGBColorSpace, type ShaderMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { crtMaterial } from "./crt-material";

type ScreenMat = ShaderMaterial & { map: CanvasTexture | null };

const material = crtMaterial as ScreenMat;

interface MacModelProps {
  screenCanvas: HTMLCanvasElement | null;
  zooming?: boolean;
  enableFloat?: boolean;
}

export const MacModel = ({
  screenCanvas,
  zooming = false,
  enableFloat = true,
}: MacModelProps) => {
  const gltf = useLoader(GLTFLoader, "/mac.glb");
  const screenRef = useRef<Mesh>(null);
  const texRef = useRef<CanvasTexture | null>(null);

  useEffect(() => {
    if (!screenCanvas) return;
    const tex = new CanvasTexture(screenCanvas);
    tex.colorSpace = SRGBColorSpace;
    material.uniforms.map.value = tex;
    material.map = tex;
    texRef.current = tex;
    return () => {
      tex.dispose();
      material.uniforms.map.value = null;
      material.map = null;
    };
  }, [screenCanvas]);

  useFrame(({ clock }) => {
    if (texRef.current) texRef.current.needsUpdate = true;
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  const contents = (
    <>
      <primitive object={gltf.scene} />
      <mesh
        ref={screenRef}
        position={[0, 0.102, 0.183]}
        rotation={[(-Math.PI / 180) * 6.5, 0, 0]}
        material={material}
      >
        <planeGeometry args={[562 * 0.00062, 408 * 0.00062]} />
      </mesh>
    </>
  );

  if (!enableFloat) return <group>{contents}</group>;

  return (
    <Float
      speed={zooming ? 0 : 1.8}
      rotationIntensity={zooming ? 0 : 0.08}
      floatIntensity={zooming ? 0 : 0.06}
    >
      {contents}
    </Float>
  );
};
