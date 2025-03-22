/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useShareControl } from "@/hooks/useShareControl";
import { fragmentShader, vertexInstance } from "@/shaders";
import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

interface MainParticleSysProps {
  meshRef: any;
  fboDataTexture: THREE.DataTexture | undefined;
}

const uvCache = new Map<number, Float32Array>();

const MainParticleSys = ({ meshRef, fboDataTexture }: MainParticleSysProps) => {
  const matcap = useTexture("/img/matcap.png");
  const { QUANTITY, SIZE, NUMBER } = useShareControl();

  const uvInstance = useMemo(() => {
    if (uvCache.has(QUANTITY)) {
      return uvCache.get(QUANTITY);
    }

    // Generate new UV data if not cached
    const result = new Float32Array(NUMBER * 2);
    for (let i = 0; i < QUANTITY; i++) {
      for (let j = 0; j < QUANTITY; j++) {
        const index = i * QUANTITY + j;
        result[2 * index] = j / (QUANTITY - 1);
        result[2 * index + 1] = i / (QUANTITY - 1);
      }
    }
    // Store in cache
    uvCache.set(QUANTITY, result);
    return result;
  }, [QUANTITY]);
  return (
    <instancedMesh ref={meshRef} args={[null, null, NUMBER]}>
      <boxGeometry args={[SIZE, SIZE, SIZE]}>
        <instancedBufferAttribute
          attach="attributes-uvRef"
          args={[uvInstance, 2]}
        />
      </boxGeometry>
      <shaderMaterial
        uniforms={{
          uTexture: { value: fboDataTexture },
          time: { value: 0 },
          uVelocity: { value: null },
          uMatcap: { value: matcap },
        }}
        vertexShader={vertexInstance}
        fragmentShader={fragmentShader}
      />
    </instancedMesh>
  );
};

export default MainParticleSys;
