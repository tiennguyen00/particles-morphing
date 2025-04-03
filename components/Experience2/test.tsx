/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  fragmentShader,
  simFragment,
  simVertex,
  vertexShader,
} from "./shaders";
import { useScreen } from "@/hooks/useScreen";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const size = 512,
  number = size * size;

function lerp(a, b, n) {
  return (1 - n) * a + n * b;
}

const Experience2 = () => {
  const { width, height } = useScreen();

  const init = useRef(false);
  const v = useRef(new THREE.Vector3(0, 0, 0));
  const v1 = useRef(new THREE.Vector3(0, 0, 0));
  const currentParticles = useRef(0);
  const { scene, camera, pointer } = useThree();
  const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const loader = new GLTFLoader();
  const emitters = useRef<THREE.Mesh[]>([]);
  const emitterDir = useRef(new THREE.Vector3(0, 0, 0));
  const emitterPrev = useRef(new THREE.Vector3(0, 0, 0));
  const emitter = useRef<THREE.Mesh>(new THREE.Mesh());
  const mixer = useRef<THREE.AnimationMixer>(null);

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

  const geometry = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());
  const material = useRef<THREE.ShaderMaterial>(new THREE.ShaderMaterial());
  const simMaterial = useRef<THREE.ShaderMaterial>(null!);
  const simGeometry = useRef<THREE.BufferGeometry>(null!);
  const debugPlane = useRef<
    THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  >(null!);

  const getPointsOnSphere = useMemo(() => {
    const data = new Float32Array(4 * number);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;

        // generate point on a sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1); //
        // let phi = Math.random()*Math.PI; //
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);

        data[4 * index] = x;
        data[4 * index + 1] = y;
        data[4 * index + 2] = z;
        data[4 * index + 3] = (Math.random() - 0.5) * 0.01;
      }
    }

    const dataTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;

    return dataTexture;
  }, []);

  const setupFBO = useCallback(() => {
    // create data Texture
    const data = new Float32Array(4 * number);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;
        data[4 * index] = lerp(-0.5, 0.5, j / (size - 1));
        data[4 * index + 1] = lerp(-0.5, 0.5, i / (size - 1));
        data[4 * index + 2] = 0;
        data[4 * index + 3] = 1;
      }
    }

    const positions = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    positions.needsUpdate = true;

    // create FBO scene
    simGeometry.current = new THREE.BufferGeometry();
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
    simGeometry.current.setAttribute(
      "position",
      new THREE.BufferAttribute(pos, 3)
    );
    simGeometry.current.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

    simMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uMouse: { value: new THREE.Vector3(0, 0, 0) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSource: { value: new THREE.Vector3(0, 0, 0) },
        uRenderMode: { value: 0 },
        uCurrentPosition: { value: getPointsOnSphere },
        uDirections: { value: null },
      },
      vertexShader: simVertex,
      fragmentShader: simFragment,
    });
    const simMesh = new THREE.Points(simGeometry.current, simMaterial.current);
    sceneFBO.current.add(simMesh);

    return { positions };
  }, [getPointsOnSphere]);

  const addObjects = useCallback(() => {
    geometry.current = new THREE.BufferGeometry();
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
    geometry.current.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.current.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    material.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // uTexture: { value: new THREE.TextureLoader().load(texture) },
        uTexture: { value: positions },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    const mesh = new THREE.Points(geometry.current, material.current);
    scene.add(mesh);

    debugPlane.current = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 1, 1),
      new THREE.MeshBasicMaterial({})
    );
    // scene.add(debugPlane);

    emitter.current = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
      })
    );
    // scene.add(emitter);

    emitterDir.current = new THREE.Vector3(0, 0, 0);
    emitterPrev.current = new THREE.Vector3(0, 0, 0);
  }, []);

  useEffect(() => {
    loader.loadAsync("/models/mesh.glb").then((gltf) => {
      const model = gltf.scene;
      scene.add(model);
      model.traverse((m) => {
        if (m.isMesh) {
          m.material = new THREE.MeshBasicMaterial({
            color: 0xa6a6d4,
            wireframe: true,
          });
        }
        // if (m.isMesh && m.name.includes("emitter")) {
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

      mixer.current = new THREE.AnimationMixer(model);
      if (gltf.animations && gltf.animations.length > 0) {
        mixer.current.clipAction(gltf.animations[0]).play();
      }
    });

    setupFBO();
    addObjects();
  }, []);

  let renderTarget = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });
  const directions = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  const initPos = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  let renderTarget1 = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  useFrame((state, delta) => {
    const elapsedTime = state.clock.elapsedTime;
    if (!simMaterial.current) return;
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

    // material.uniforms.time.value = this.time;

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
    state.gl.render(state.scene, state.camera);

    // swap render targets
    const tmp = renderTarget;
    renderTarget = renderTarget1;
    renderTarget1 = tmp;

    material.current.uniforms.uTexture.value = renderTarget.texture;
    simMaterial.current.uniforms.uCurrentPosition.value = renderTarget1.texture;
    simMaterial.current.uniforms.uTime.value = elapsedTime;

    debugPlane.current.material.map = renderTarget.texture;
    if (mixer.current) {
      mixer.current.update(delta);
    }
  });

  return null;
};

export default Experience2;
