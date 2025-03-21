import { useFBO, useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useWindowSize } from "@/utils/useScreen";
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
const PARTICLE_SIZE = 0.01;
const DUMMY_SPHERE_SIZE = 0.01;
const DUMMY_SPHERE_SEGMENTS = 32;
const DUMMY_INDICATOR_POSITION = new THREE.Vector3(0, 99, 0);
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);

const Experience = () => {
  const { camera, pointer, scene, gl } = useThree();

  const matcap = useTexture("/img/matcap.png");
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

  const { width, height } = useWindowSize();
  const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster());
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
  const boxGeometry = useMemo(
    () => new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE),
    []
  );
  const sphereGeometry = useMemo(
    () =>
      new THREE.SphereGeometry(
        DUMMY_SPHERE_SIZE,
        DUMMY_SPHERE_SEGMENTS,
        DUMMY_SPHERE_SEGMENTS
      ),
    []
  );

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
  useFrame((state) => {
    const { clock } = state;

    if (!sampler.current || !gpuCompute.current || !shaderMaterial.current)
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
      shaderMaterial.current.uniforms.uVelocity.value =
        gpuCompute.current.getCurrentRenderTarget(
          velocityVariable.current
        ).texture;
    }
    if (positionVariable.current) {
      shaderMaterial.current.uniforms.uTexture.value =
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
    if (!meshModel) return;

    // Initialize the sampler
    sampler.current = new MeshSurfaceSampler(meshModel as THREE.Mesh);
    sampler.current.build();

    // Building Instanced Mesh with physics
    shaderMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: setUpFBO?.positions },
        time: { value: 0 },
        uVelocity: { value: null },
        uMatcap: { value: matcap },
      },
      vertexShader: vertexInstance,
      fragmentShader: fragmentShader,
    });

    const mesh = new THREE.InstancedMesh(
      boxGeometry,
      shaderMaterial.current,
      NUMBER
    );

    // Create instance uv reference
    const uvInstance = new Float32Array(NUMBER * 2);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const index = i * SIZE + j;
        uvInstance[2 * index] = j / (SIZE - 1);
        uvInstance[2 * index + 1] = i / (SIZE - 1);
      }
    }
    boxGeometry.setAttribute(
      "uvRef",
      new THREE.InstancedBufferAttribute(uvInstance, 2)
    );

    scene.add(mesh);

    // Cleanup function
    return () => {
      boxGeometry.dispose();
      shaderMaterial.current.dispose();
      mesh.dispose();
      scene.remove(mesh);
    };
  }, [meshModel, setUpFBO, boxGeometry, matcap, scene]);

  // Initialize GPGPU when point data is ready
  useEffect(() => {
    if (getPointOnModel) initGPGPU();
  }, [getPointOnModel, initGPGPU]);

  // Setup mouse interaction
  useEffect(() => {
    if (!meshModel || !(meshModel instanceof THREE.Mesh)) return;

    const raycasterMesh = new THREE.Mesh(
      meshModel.geometry.clone(),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    scene.add(raycasterMesh);

    const handleMouseMove = (e: MouseEvent) => {
      pointer.x = (e.clientX / width) * 2 - 1;
      pointer.y = -(e.clientY / height) * 2 + 1;
      raycaster.current.setFromCamera(pointer, camera);

      const intersects = raycaster.current.intersectObjects([raycasterMesh]);

      if (!simMaterial.current) return;

      if (intersects.length > 0) {
        const point = intersects[0].point;

        // Update all mouse uniforms at once with the same value
        simMaterial.current.uniforms.uMouse.value = point;
        if (positionUniforms.current)
          positionUniforms.current.uMouse.value = point;
        if (velocityUniforms.current)
          velocityUniforms.current.uMouse.value = point;
      } else {
        // Use a pre-defined vector for better performance
        simMaterial.current.uniforms.uMouse.value = DUMMY_INDICATOR_POSITION;
        if (positionUniforms.current)
          positionUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
        if (velocityUniforms.current)
          velocityUniforms.current.uMouse.value = DUMMY_INDICATOR_POSITION;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Proper cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      scene.remove(raycasterMesh);
      raycasterMesh.geometry.dispose();
      (raycasterMesh.material as THREE.Material).dispose();
    };
  }, [camera, width, height, pointer, scene, meshModel, sphereGeometry]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Dispose all Three.js resources on unmount
      if (planeGeometry) planeGeometry.dispose();
      if (sphereGeometry) sphereGeometry.dispose();
      if (simMaterial.current) simMaterial.current.dispose();
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
  }, [planeGeometry, sphereGeometry]);

  return <></>;
};

export default Experience;
