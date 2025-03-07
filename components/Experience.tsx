"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { vertexShader, fragmentShader } from "@/shaders";
import { useMemo } from "react";
import * as THREE from "three";

const Points = () => {
  const uniforms = useMemo(
    () => ({
      uTime: new THREE.Uniform(0),
    }),
    []
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });
  return (
    <points>
      <planeGeometry args={[1, 1, 50, 50]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        wireframe={true}
      />
    </points>
  );
};

export default function Experience() {
  return (
    <Canvas
      style={{ width: "100%", height: "100dvh" }}
      camera={{ position: [0, 0, 1], fov: 70, near: 0.01, far: 10 }}
    >
      <OrbitControls />
      <Points />
    </Canvas>
  );
}
