/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
import { useRef } from "react";
import * as THREE from "three";
import Experience from "@/components/Experience2";
import { OrbitControls, StatsGl } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Horse from "@/components/Experience2/Horse";

export default function Home() {
  const cubePos = useRef(new THREE.Vector3());
  return (
    <Canvas
      id="canvas-12323"
      style={{ width: "100%", height: "100dvh" }}
      camera={{ position: [-20, 0, 40], fov: 70, near: 0.01, far: 100 }}
      gl={{
        alpha: true,
        antialias: true,
      }}
    >
      <axesHelper />
      <color attach="background" args={["#222"]} />
      {/* <StatsGl className="top-0 left-0 fixed" trackGPU /> */}
      <OrbitControls />
      <Experience cubePos={cubePos} />

      <Horse cubePos={cubePos} />
    </Canvas>
  );
}
