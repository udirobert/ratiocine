"use client";

import {
  ContactShadows,
  Float,
  OrbitControls,
  Stage,
} from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { RefObject, Suspense, useEffect, useRef, useState } from "react";
import { CanvasTexture, Mesh, SRGBColorSpace, type ShaderMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { crtMaterial } from "./crt-material";

type ScreenMat = ShaderMaterial & { map: CanvasTexture | null };
const material = crtMaterial as ScreenMat;

const Mac = ({ screenCanvas }: { screenCanvas: HTMLCanvasElement | null }) => {
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
  screenCanvasRef,
}: {
  screenCanvasRef: RefObject<HTMLCanvasElement | null>;
}) => {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    requestAnimationFrame(() => setEl(screenCanvasRef.current));
  }, [screenCanvasRef]);

  // Don't render the full 3D scene on mobile — too heavy
  if (isMobile) return null;

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
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
          <Mac screenCanvas={el} />
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
        enableZoom={false}
        minDistance={2}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
};
