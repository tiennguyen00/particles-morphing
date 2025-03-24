/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  GPUComputationRenderer,
  Variable,
} from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { simFragmentPosition, simFragmentVelocity, simVertex } from "@/shaders";
import { lerp } from "three/src/math/MathUtils.js";
import MainParticleSys from "./MainParticleSys";
import { useShareControl } from "@/hooks/useShareControl";

// Constants moved outside component for better performance
const DUMMY_INDICATOR_POSITION = new THREE.Vector3(0, 99, 0);
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);
const planeGeometry = new THREE.PlaneGeometry(2, 2, 2, 2);

// ================================

const Experience = () => {
  const { gl } = useThree();
  const [ready, setReady] = useState(false);
  const { QUANTITY, NUMBER, FICTION, SCOPE, SHAPE_FORCE, MOUSE_REPEL_FORCE } =
    useShareControl();

  // Cache for model points at different resolutions
  const pointsCache = useRef<Map<number, THREE.DataTexture>>(new Map());

  // Create refs for the meshes we'll create declaratively
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const meshModel = useRef<THREE.Mesh>(null!);
  const dataFBO = useRef<THREE.DataTexture>(null!);
  const sampler = useRef<MeshSurfaceSampler>(null!);
  const gpuCompute = useRef<GPUComputationRenderer>(null!);
  const positionVariable = useRef<Variable | null>(null);
  const velocityVariable = useRef<Variable | null>(null);
  const positionUniforms = useRef<any>(null);
  const velocityUniforms = useRef<any>(null);

  const sceneFBO = useRef(new THREE.Scene());
  const simMaterial = useRef<THREE.ShaderMaterial>(null!);
  const cameraFBO = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, -2, 2));
  cameraFBO.current.position.z = 1;
  cameraFBO.current.lookAt(ZERO_VECTOR);

  const model = useGLTF("/models/wooden-dragon.glb");

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    model.scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });
    meshModel.current = meshes[0];
    // Create the sampler for preparing get position on model
    sampler.current = new MeshSurfaceSampler(meshModel.current as THREE.Mesh);
    sampler.current.build();

    setReady(true);
  }, []);

  const getPointOnModel = useMemo(() => {
    if (!sampler.current) return;

    // Check cache first
    if (pointsCache.current.has(QUANTITY)) {
      return { dataTexture: pointsCache.current.get(QUANTITY) };
    }

    // If not in cache, create new data
    const data = new Float32Array(4 * NUMBER);
    for (let i = 0; i < QUANTITY; i++) {
      for (let j = 0; j < QUANTITY; j++) {
        const index = i * QUANTITY + j;

        const position = new THREE.Vector3();
        sampler.current.sample(position);

        data[4 * index] = position.x;
        data[4 * index + 1] = position.y;
        data[4 * index + 2] = position.z;
        data[4 * index + 3] = 1;
      }
    }

    const dataTexture = new THREE.DataTexture(
      data,
      QUANTITY,
      QUANTITY,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;

    // Store in cache
    pointsCache.current.set(QUANTITY, dataTexture);

    return { dataTexture };
  }, [sampler.current, QUANTITY]);

  // Switch to GPGPU and then add the velocity
  const initGPGPU = () => {
    // Create the dataTexture for velocities
    const data = new Float32Array(4 * NUMBER);
    const velocitiesDataTexture = new THREE.DataTexture(
      data,
      QUANTITY,
      QUANTITY,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    velocitiesDataTexture.needsUpdate = true;
    //===================================
    const pointOnModel = getPointOnModel?.dataTexture as THREE.DataTexture;
    const velocitiesOnSphere = velocitiesDataTexture;

    gpuCompute.current = new GPUComputationRenderer(QUANTITY, QUANTITY, gl);

    positionVariable.current = gpuCompute.current.addVariable(
      "uCurrentPosition",
      simFragmentPosition,
      pointOnModel
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
    positionUniforms.current!.uOriginalPosition = { value: pointOnModel };

    velocityUniforms.current!.uTime = { value: 0 };
    velocityUniforms.current!.uMouse = { value: ZERO_VECTOR.clone() };
    velocityUniforms.current!.uOriginalPosition = { value: pointOnModel };
    velocityUniforms.current!.uFiction = { value: FICTION };
    velocityUniforms.current!.uScope = { value: SCOPE };
    velocityUniforms.current!.uShapeForce = { value: SHAPE_FORCE };
    velocityUniforms.current!.uMouseRepelForce = { value: MOUSE_REPEL_FORCE };

    gpuCompute.current.init();
  };

  // This return the DataTexture for FBO
  const setUpFBO = () => {
    const data = new Float32Array(4 * NUMBER);
    for (let i = 0; i < QUANTITY; i++) {
      for (let j = 0; j < QUANTITY; j++) {
        const index = i * QUANTITY + j;
        data[4 * index] = lerp(-0.5, 0.5, j / (QUANTITY - 1));
        data[4 * index + 1] = lerp(-0.5, 0.5, i / (QUANTITY - 1));
        data[4 * index + 2] = 0;
        data[4 * index + 3] = 1;
      }
    }
    const positions = new THREE.DataTexture(
      data,
      QUANTITY,
      QUANTITY,
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
        uCurrentPosition: { value: getPointOnModel?.dataTexture },
        uOriginalPosition: { value: getPointOnModel?.dataTexture },
        uOriginalPosition1: { value: getPointOnModel?.dataTexture },
      },
      vertexShader: simVertex,
      fragmentShader: simFragmentPosition,
    });
    simMaterial.current.needsUpdate = true;
    const simMesh = new THREE.Mesh(planeGeometry, simMaterial.current);
    sceneFBO.current.add(simMesh);

    return { positions };
  };

  useEffect(() => {
    if (!getPointOnModel) return;
    initGPGPU();

    // SetUp FBO
    dataFBO.current = setUpFBO()?.positions;

    // Reset mouse values to ensure they're connected to the new uniforms
    if (simMaterial.current)
      simMaterial.current.uniforms.uMouse.value = DUMMY_INDICATOR_POSITION;
    if (positionUniforms.current)
      positionUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
    if (velocityUniforms.current)
      velocityUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
  }, [getPointOnModel, QUANTITY]);

  // More efficient animation frame handling
  useFrame(({ clock, camera }: { clock: any; camera: THREE.Camera }) => {
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
    if (velocityUniforms.current) {
      velocityUniforms.current.uTime.value = elapsedTime;
      velocityUniforms.current.uFiction.value = FICTION;
      velocityUniforms.current.uScope.value = SCOPE;
      velocityUniforms.current.uShapeForce.value = SHAPE_FORCE;
      velocityUniforms.current.uMouseRepelForce.value = MOUSE_REPEL_FORCE;
    }

    // Update shader uniforms with computed textures
    if (velocityVariable.current) {
      (
        meshRef.current.material as THREE.ShaderMaterial
      ).uniforms.uVelocity.value = gpuCompute.current.getCurrentRenderTarget(
        velocityVariable.current
      ).texture;
    }
    if (positionVariable.current) {
      (
        meshRef.current.material as THREE.ShaderMaterial
      ).uniforms.uTexture.value = gpuCompute.current.getCurrentRenderTarget(
        positionVariable.current
      ).texture;
    }
  });

  return (
    <>
      {/* Main particle system */}
      {ready && !!dataFBO && (
        <MainParticleSys
          key={`particles-${QUANTITY}`}
          meshRef={meshRef}
          fboDataTexture={dataFBO.current}
        />
      )}

      {/* Invisible mesh for raycasting */}
      {meshModel.current && (
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
          <primitive object={meshModel.current.geometry.clone()} />
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
