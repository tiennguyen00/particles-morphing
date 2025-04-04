/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFBO, useGLTF, useAnimations } from "@react-three/drei";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import {
  fragmentShader,
  simFragment,
  simVertex,
  vertexShader,
} from "./shaders";
import { useScreen } from "@/hooks/useScreen";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { lerp } from "three/src/math/MathUtils.js";
import "./shaders/RenderMaterial";
import "./shaders/SimMaterial";

const size = 512,
  number = size * size;

const Experience = () => {
  const { width, height } = useScreen();

  const { scene, camera, pointer } = useThree();
  const init = useRef(false);
  const v = useRef(new THREE.Vector3(0, 0, 0));
  const v1 = useRef(new THREE.Vector3(0, 0, 0));
  const currentParticles = useRef(0);
  const emitters = useRef<THREE.Mesh[]>([]);
  const emitterDir = useRef(new THREE.Vector3(0, 0, 0));
  const emitterPrev = useRef(new THREE.Vector3(0, 0, 0));

  const sceneFBO = useRef<THREE.Scene>(new THREE.Scene());
  const viewArea = size / 2 + 0.01;
  const cameraFBO = useRef<THREE.OrthographicCamera>(
    new THREE.OrthographicCamera(
      -viewArea,
      viewArea,
      viewArea,
      -viewArea,
      -2,
      2
    )
  );
  cameraFBO.current.position.z = 1;
  cameraFBO.current.lookAt(new THREE.Vector3(0, 0, 0));

  const geometry = useRef<THREE.BufferGeometry>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const simMaterial = useRef<THREE.ShaderMaterial>(null!);
  const simGeometry = useRef<THREE.BufferGeometry>(null!);

  const { scene: scene1, animations } = useGLTF("/models/mesh.glb");
  const { actions, clips, mixer } = useAnimations(animations, scene1);

  useEffect(() => {
    scene1.traverse((m) => {
      if (m.isMesh) {
        m.material = new THREE.MeshBasicMaterial({
          color: 0xa6a6d4,
          wireframe: true,
        });
      }
      if (m.isMesh && m.geometry.attributes.position.array.length < 120) {
        emitters.current.push({
          mesh: m,
          prev: m.position.clone(),
          dir: new THREE.Vector3(0, 0, 0),
        });
        m.visible = false;
        m.material = new THREE.MeshBasicMaterial({
          color: 0xff0000,
        });
      }
    });

    scene1.rotation.x = -Math.PI / 16;

    mixer.clipAction(clips[0]).play();
    mixer.timeScale = 0.5;
  }, []);

  let renderTarget = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  const directions = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  const initPos = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  let renderTarget1 = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  useFrame((state, delta) => {
    const elapsedTime = state.clock.elapsedTime;

    if (scene1) {
      scene1.position.y = Math.sin(elapsedTime * 12) * 0.18;
    }

    if (!simMaterial.current || !simGeometry.current) return;
    if (!init.current) {
      init.current = true;

      // DIRECTIONS
      simMaterial.current.uniforms.uRenderMode.value = 1;
      simMaterial.current.uniforms.uTime.value = -100;
      simMaterial.current.uniforms.uSource.value = new THREE.Vector3(0, -1, 0);
      state.gl.setRenderTarget(directions);
      state.gl.render(sceneFBO.current, cameraFBO.current);
      simMaterial.current.uniforms.uDirections.value = directions.texture;

      // // POSITIONS
      simMaterial.current.uniforms.uRenderMode.value = 2;
      simMaterial.current.uniforms.uSource.value = new THREE.Vector3(0, 0, 0);
      state.gl.setRenderTarget(initPos);
      state.gl.render(sceneFBO.current, cameraFBO.current);
      simMaterial.current.uniforms.uCurrentPosition.value = initPos.texture;
    }

    // SIMULATION
    simMaterial.current.uniforms.uDirections.value = directions.texture;
    simMaterial.current.uniforms.uRenderMode.value = 0;

    simGeometry.current.setDrawRange(0, number);
    state.gl.setRenderTarget(renderTarget);
    state.gl.render(sceneFBO.current, cameraFBO.current);

    // BEGIN EMITTER
    const emit = 15;
    state.gl.autoClear = false;

    emitters.current.forEach((emitter) => {
      emitter.mesh.getWorldPosition(v.current);
      v1.current = v.current.clone();
      const flip = Math.random() > 0.5;

      emitter.dir = v.current.clone().sub(emitter.prev).multiplyScalar(100);
      simGeometry.current.setDrawRange(currentParticles.current, emit);

      // DIRECTIONS
      simMaterial.current.uniforms.uRenderMode.value = 1;
      simMaterial.current.uniforms.uDirections.value = null;
      simMaterial.current.uniforms.uCurrentPosition.value = null;
      if (flip) emitter.dir.x *= -1;
      simMaterial.current.uniforms.uSource.value = emitter.dir;
      state.gl.setRenderTarget(directions);
      state.gl.render(sceneFBO.current, cameraFBO.current);

      // POSITIONS
      simMaterial.current.uniforms.uRenderMode.value = 2;
      if (flip) v1.current.x *= -1;
      simMaterial.current.uniforms.uSource.value = v1.current;
      state.gl.setRenderTarget(renderTarget);
      state.gl.render(sceneFBO.current, cameraFBO.current);

      currentParticles.current += emit;
      if (currentParticles.current > number) {
        currentParticles.current = 0;
      }

      emitter.prev = v.current.clone();
    });

    // END OF EMIITER

    // RENDER SCENE
    state.gl.setRenderTarget(null);

    // swap render targets
    const tmp = renderTarget;
    renderTarget = renderTarget1;
    renderTarget1 = tmp;

    material.current.uniforms.uTexture.value = renderTarget.texture;
    simMaterial.current.uniforms.uCurrentPosition.value = renderTarget1.texture;
    simMaterial.current.uniforms.uTime.value = elapsedTime;

    if (mixer) {
      mixer.update(delta);
    }
  });

  // ================================
  // New code here
  const { positions, uvs } = useMemo(() => {
    const positions = new Float32Array(number * 3);
    const uvs = new Float32Array(number * 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;

        positions[3 * index] = j / size - 0.5;
        positions[3 * index + 1] = i / size - 0.5;
        positions[3 * index + 2] = 0;

        uvs[2 * index] = j / (size - 1);
        uvs[2 * index + 1] = i / (size - 1);
      }
    }
    return { positions, uvs };
  }, []);
  const { positionSim, uvsSim } = useMemo(() => {
    const pos = new Float32Array(number * 3);
    const uv = new Float32Array(number * 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;

        pos[3 * index] = size * lerp(-0.5, 0.5, j / (size - 1));
        pos[3 * index + 1] = size * lerp(-0.5, 0.5, i / (size - 1));
        pos[3 * index + 2] = 0;

        uv[2 * index] = j / (size - 1);
        uv[2 * index + 1] = i / (size - 1);
      }
    }
    return { positionSim: pos, uvsSim: uv };
  }, []);

  return (
    <>
      <primitive object={scene1} />
      {createPortal(
        <points>
          <bufferGeometry ref={simGeometry}>
            <bufferAttribute
              attach="attributes-position"
              count={positionSim.length / 3}
              array={positionSim}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-uv"
              count={uvsSim.length / 2}
              array={uvsSim}
              itemSize={2}
            />
          </bufferGeometry>
          <simMaterial ref={simMaterial} />
        </points>,
        sceneFBO.current
      )}
      <points>
        <bufferGeometry ref={geometry}>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-uv"
            count={uvs.length / 2}
            array={uvs}
            itemSize={2}
          />
        </bufferGeometry>
        <renderMaterial
          ref={material}
          depthWrite={false}
          depthTest={false}
          transparent
        />
      </points>
    </>
  );
};

export default Experience;
