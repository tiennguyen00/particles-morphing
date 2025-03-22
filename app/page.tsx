/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
import Experience from "@/components/Experience";
import { OrbitControls, StatsGl } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";

export default function Home() {
  return (
    <div className="w-[100dvw] min-h-[100dvh]">
      <div className="fixed z-[999] bottom-6 right-6 ">
        <Link href="https://github.com/tiennguyen00" target="_blank">
          <img
            src="/img/github.png"
            alt="about"
            width={"32px"}
            height={"32px"}
          />
        </Link>
      </div>
      <Canvas
        style={{ width: "100%", height: "100dvh" }}
        camera={{ position: [0, 0, 2], fov: 70, near: 0.01, far: 10 }}
        gl={{
          alpha: true,
          antialias: true,
        }}
      >
        <color attach="background" args={["#222"]} />
        <StatsGl className="top-0 left-0 fixed" trackGPU />
        <OrbitControls />
        <Experience />
      </Canvas>
    </div>
  );
}
