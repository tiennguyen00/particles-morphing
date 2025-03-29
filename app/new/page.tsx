/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
import Experience from "@/components/Experience2";
import { OrbitControls, StatsGl } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export default function Home() {
  return (
    <Canvas
      style={{ width: "100%", height: "100dvh" }}
      camera={{ position: [0, 0, 2], fov: 70, near: 0.01, far: 10 }}
      gl={{
        alpha: true,
        antialias: true,
      }}
    >
      <axesHelper />
      <color attach="background" args={["#222"]} />
      <StatsGl className="top-0 left-0 fixed" trackGPU />
      <OrbitControls />
      <Experience />
    </Canvas>
  );
}
