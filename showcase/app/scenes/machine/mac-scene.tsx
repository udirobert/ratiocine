"use client";

import {
  ContactShadows,
  Float,
  OrbitControls,
  Stage,
} from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { RefObject, Suspense, useEffect, useRef, useState } from "react";
import { HTMLTexture, Mesh, type ShaderMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { crtMaterial } from "./crt-material";

type ScreenMat = ShaderMaterial & { map: HTMLTexture | null };
const material = crtMaterial as ScreenMat;

const Mac = ({ screenEl }: { screenEl: HTMLElement | null }) => {
  const gltf = useLoader(GLTFLoader, "/mac.glb");
  const screenRef = useRef<Mesh>(null);

  useEffect(() => {
    if (!screenEl) return;
    const texture = new HTMLTexture(screenEl);
    material.uniforms.map.value = texture;
    material.map = texture;
  }, [screenEl]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <Float speed={1.8} rotationIntensity={0.08} floatIntensity={0.06}>
      <primitive object={gltf.scene} />
      <mesh
        ref={screenRef}
        position={[0, 0.102, 0.183]}
        rotation={[(-Math.PI / 180) * 6.5, 0, 0]}
        material={material}
      >
        <planeGeometry args={[562 * 0.00062, 408 * 0.00062]} />
      </mesh>
    </Float>
  );
};

export const MacScene = ({
  screenElRef,
}: {
  screenElRef: RefObject<HTMLDivElement | null>;
}) => {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Give the DOM a frame to paint before sampling
    requestAnimationFrame(() => {
      setEl(screenElRef.current);
    });
  }, [screenElRef]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ position: [0.02, 0.01, 0.05], fov: 24, near: 0.1, far: 100 }}
      className="absolute inset-0"
    >
      <Suspense fallback={null}>
        <Stage
          intensity={0.5}
          environment="forest"
          shadows={false}
          adjustCamera={false}
        >
          <Mac screenEl={el} />
        </Stage>
      </Suspense>
      <ContactShadows
        position={[0, -0.35, 0]}
        opacity={0.4}
        blur={2}
        far={4}
        resolution={128}
      />
      <OrbitControls
        enableDamping
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
};
