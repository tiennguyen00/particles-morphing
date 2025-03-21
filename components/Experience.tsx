import { useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  GPUComputationRenderer,
  Variable,
} from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import {
  fragmentShader,
  simFragmentPosition,
  simFragmentVelocity,
  simVertex,
  vertexInstance,
} from "@/shaders";
import { lerp } from "three/src/math/MathUtils.js";

// Constants moved outside component for better performance
const SIZE = 256;
const NUMBER = SIZE * SIZE;
const PARTICLE_SIZE = 0.012;
const DUMMY_INDICATOR_POSITION = new THREE.Vector3(0, 99, 0);
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);
// ================================

const Experience = () => {
  const { gl } = useThree();
  const matcap = useTexture("/img/matcap.png");
  const [ready, setReady] = useState(false);

  // Create refs for the meshes we'll create declaratively
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const sampler = useRef<MeshSurfaceSampler>(null!);
  const gpuCompute = useRef<GPUComputationRenderer>(null!);
  const positionVariable = useRef<Variable | null>(null);
  const velocityVariable = useRef<Variable | null>(null);
  const positionUniforms = useRef<{
    [uniform: string]: THREE.IUniform<any>;
  } | null>(null);
  const velocityUniforms = useRef<{
    [uniform: string]: THREE.IUniform<any>;
  } | null>(null);

  const shaderMaterial = useRef<THREE.ShaderMaterial>(null!);
  const sceneFBO = useRef<THREE.Scene>(new THREE.Scene());
  const cameraFBO = useRef<THREE.OrthographicCamera>(
    new THREE.OrthographicCamera(-1, 1, 1, -1, -2, 2)
  );
  cameraFBO.current.position.z = 1;
  cameraFBO.current.lookAt(ZERO_VECTOR);

  const simMaterial = useRef<THREE.ShaderMaterial>(null!);

  // Cached geometries to avoid recreating
  const planeGeometry = useMemo(() => new THREE.PlaneGeometry(2, 2, 2, 2), []);

  const uvInstance = useMemo(() => {
    const result = new Float32Array(NUMBER * 2);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const index = i * SIZE + j;
        result[2 * index] = j / (SIZE - 1);
        result[2 * index + 1] = i / (SIZE - 1);
      }
    }
    return result;
  }, []);

  const getPointOnModel = useMemo(() => {
    if (!sampler.current) return;
    const data = new Float32Array(4 * NUMBER);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const index = i * SIZE + j;

        const position = new THREE.Vector3();
        sampler.current.sample(position);

        data[4 * index] = position.x;
        data[4 * index + 1] = position.y;
        data[4 * index + 2] = position.z;
        data[4 * index + 3] = (Math.random() - 0.5) * 0.01;
      }
    }

    const dataTexture = new THREE.DataTexture(
      data,
      SIZE,
      SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;

    return { dataTexture };
  }, [sampler.current]);

  const getVelocitiesOnSphere = useMemo(() => {
    const data = new Float32Array(4 * NUMBER);
    // This can be filled with zeros using a single operation
    data.fill(0);

    const dataTexture = new THREE.DataTexture(
      data,
      SIZE,
      SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;

    return { dataTexture };
  }, []);

  // Switch to GPGPU and then add the velocity
  const initGPGPU = useCallback(() => {
    if (!getPointOnModel) return;

    const pointOnASphere = getPointOnModel.dataTexture;
    const velocitiesOnSphere = getVelocitiesOnSphere.dataTexture;

    gpuCompute.current = new GPUComputationRenderer(SIZE, SIZE, gl);

    positionVariable.current = gpuCompute.current.addVariable(
      "uCurrentPosition",
      simFragmentPosition,
      pointOnASphere
    );
    velocityVariable.current = gpuCompute.current.addVariable(
      "uCurrentVelocity",
      simFragmentVelocity,
      velocitiesOnSphere
    );

    gpuCompute.current.setVariableDependencies(positionVariable.current, [
      positionVariable.current,
      velocityVariable.current,
    ]);
    gpuCompute.current.setVariableDependencies(velocityVariable.current, [
      velocityVariable.current,
      positionVariable.current,
    ]);

    positionUniforms.current = positionVariable.current.material.uniforms;
    velocityUniforms.current = velocityVariable.current.material.uniforms;

    positionUniforms.current!.uTime = { value: 0 };
    positionUniforms.current!.uMouse = { value: ZERO_VECTOR.clone() };
    positionUniforms.current!.uOriginalPosition = { value: pointOnASphere };

    velocityUniforms.current!.uTime = { value: 0 };
    velocityUniforms.current!.uMouse = { value: ZERO_VECTOR.clone() };
    velocityUniforms.current!.uOriginalPosition = { value: pointOnASphere };

    gpuCompute.current.init();
  }, [getPointOnModel, getVelocitiesOnSphere, gl]);

  // This return the DataTexture for FBO
  const setUpFBO = useMemo(() => {
    if (!getPointOnModel) return;
    const data = new Float32Array(4 * NUMBER);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const index = i * SIZE + j;
        data[4 * index] = lerp(-0.5, 0.5, j / (SIZE - 1));
        data[4 * index + 1] = lerp(-0.5, 0.5, i / (SIZE - 1));
        data[4 * index + 2] = 0;
        data[4 * index + 3] = 1;
      }
    }
    const positions = new THREE.DataTexture(
      data,
      SIZE,
      SIZE,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    positions.needsUpdate = true;

    // create FBO scene
    simMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uMouse: { value: null },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uCurrentPosition: { value: getPointOnModel.dataTexture },
        uOriginalPosition: { value: getPointOnModel.dataTexture },
        uOriginalPosition1: { value: getPointOnModel.dataTexture },
      },
      vertexShader: simVertex,
      fragmentShader: simFragmentPosition,
    });
    simMaterial.current.needsUpdate = true;
    const simMesh = new THREE.Mesh(planeGeometry, simMaterial.current);
    sceneFBO.current.add(simMesh);

    return { positions };
  }, [getPointOnModel, planeGeometry]);

  // More efficient animation frame handling
  useFrame(({ clock }) => {
    if (
      !gpuCompute.current ||
      !meshRef.current?.material ||
      !meshRef.current ||
      !ready
    )
      return;

    // Run GPU computation
    gpuCompute.current.compute();

    // Update time uniform
    const elapsedTime = clock.getElapsedTime();
    if (positionUniforms.current) {
      positionUniforms.current.uTime.value = elapsedTime;
    }

    // Update shader uniforms with computed textures
    if (velocityVariable.current) {
      meshRef.current.material.uniforms.uVelocity.value =
        gpuCompute.current.getCurrentRenderTarget(
          velocityVariable.current
        ).texture;
    }
    if (positionVariable.current) {
      meshRef.current.material.uniforms.uTexture.value =
        gpuCompute.current.getCurrentRenderTarget(
          positionVariable.current
        ).texture;
    }
  });

  const model = useGLTF("/models/wooden-dragon.glb");
  const meshModel = useMemo(() => {
    if (!model) return;

    // Find the first mesh in the model
    let firstMesh: THREE.Mesh | null = null;
    model.scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh && !firstMesh) {
        firstMesh = child as THREE.Mesh;
      }
    });

    return firstMesh;
  }, [model]);

  // Setup the sampler and instanced mesh
  useEffect(() => {
    if (!meshModel || !meshRef.current) return;

    // Initialize the sampler
    sampler.current = new MeshSurfaceSampler(meshModel as THREE.Mesh);
    sampler.current.build();

    // Building Instanced Mesh with physics - we'll use this imperatively for performance

    console.log("meshrefcurrent", meshRef.current.material);

    // Apply the shader material to the instanced mesh

    setReady(true);
  }, [meshModel, setUpFBO, matcap]);

  // Initialize GPGPU when point data is ready
  useEffect(() => {
    if (getPointOnModel) initGPGPU();
  }, [getPointOnModel, initGPGPU]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Dispose all Three.js resources on unmount
      if (planeGeometry) planeGeometry.dispose();
      if (simMaterial.current) simMaterial.current.dispose();
      if (meshRef.current?.material) meshRef.current?.material.dispose();
      if (sceneFBO.current) {
        sceneFBO.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [planeGeometry]);

  return (
    <>
      {/* Main particle system */}
      <instancedMesh ref={meshRef} args={[null, null, NUMBER]}>
        <boxGeometry args={[PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE]}>
          <instancedBufferAttribute
            attach="attributes-uvRef"
            args={[uvInstance, 2]}
          />
        </boxGeometry>
        {ready && !!setUpFBO?.positions && (
          <shaderMaterial
            uniforms={{
              uTexture: { value: setUpFBO?.positions },
              time: { value: 0 },
              uVelocity: { value: null },
              uMatcap: { value: matcap },
            }}
            vertexShader={vertexInstance}
            fragmentShader={fragmentShader}
          />
        )}
      </instancedMesh>

      {/* Invisible mesh for raycasting */}
      {meshModel && (
        <mesh
          visible={false}
          onPointerMove={(e) => {
            const point = e.point;
            if (simMaterial.current)
              simMaterial.current.uniforms.uMouse.value = point;
            if (positionUniforms.current)
              positionUniforms.current.uMouse.value = point;
            if (velocityUniforms.current)
              velocityUniforms.current.uMouse.value = point;
            e.stopPropagation();
          }}
          onPointerOut={() => {
            if (simMaterial.current)
              simMaterial.current.uniforms.uMouse.value =
                DUMMY_INDICATOR_POSITION;
            if (positionUniforms.current)
              positionUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
            if (velocityUniforms.current)
              velocityUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
          }}
        >
          <primitive object={meshModel.geometry.clone()} />
        </mesh>
      )}

      {/* <CycleRaycast
        onChanged={(objects, cycle) => {
          if (objects.length) {
            const point = objects[0].point;
            console.log("point: ", point);
          }
        }}
      /> */}
    </>
  );
};

export default Experience;
