import {
  fragmentShader,
  simFragment,
  simVertex,
  vertexShader,
} from "@/shaders/index2";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { lerp } from "three/src/math/MathUtils.js";
import { useTexture } from "@react-three/drei";
const Experience2 = () => {
  const size = 64;
  const number = size * size;
  const geometry = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());
  const material = useRef<THREE.ShaderMaterial>(null);
  const simMaterial = useRef<THREE.ShaderMaterial>(null);
  const { scene } = useThree();
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
  const debugPlane = useRef<THREE.Mesh>(null!);

  const getPointsOnSphere = () => {
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
  };

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

  const setupFBO = () => {
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

    geometry.current = new THREE.BufferGeometry();
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
    geometry.current.setAttribute(
      "position",
      new THREE.BufferAttribute(pos, 3)
    );
    geometry.current.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

    // this.geo.setDrawRange(3, 10);

    simMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uMouse: { value: new THREE.Vector3(0, 0, 0) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSource: { value: new THREE.Vector3(0, 0, 0) },
        uRenderMode: { value: 0 },
        uCurrentPosition: { value: getPointsOnSphere() },
        uDirections: { value: null },
      },
      vertexShader: simVertex,
      fragmentShader: simFragment,
    });
    const simMesh = new THREE.Points(geometry.current, simMaterial.current);
    sceneFBO.current.add(simMesh);
  };
  const positionsF = useRef<Float32Array>(new Float32Array(number * 3));
  const uvsF = useRef<Float32Array>(new Float32Array(number * 2));

  useEffect(() => {
    setupFBO();

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
    positionsF.current = positions;
    uvsF.current = uvs;
    const test = new THREE.BufferGeometry();
    test.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    test.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    material.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uTexture: { value: positions },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    const mesh = new THREE.Points(test, material.current);
    scene.add(mesh);

    debugPlane.current = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 1, 1),
      new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load("/img/threejs-logo.png"),
      })
    );
    scene.add(debugPlane.current);
  }, []);
  const init = useRef(false);
  const currentParticles = useRef(0);

  useFrame((state) => {
    const elapsedTime = state.clock.elapsedTime;
    if (!simMaterial.current) return;
    if (!init.current) {
      init.current = true;

      // // DIRECTIONS
      // this.simMaterial.uniforms.uRenderMode.value = 1;
      // this.simMaterial.uniforms.uSource.value = new THREE.Vector3(0,-1.,0);
      // this.renderer.setRenderTarget(this.directions);
      // this.renderer.render(this.sceneFBO, this.cameraFBO)
      // this.simMaterial.uniforms.uDirections.value = this.directions.texture;

      // // POSITIONS
      simMaterial.current.uniforms.uRenderMode.value = 2;
      simMaterial.current.uniforms.uSource.value = new THREE.Vector3(0, 0, 0);
      state.gl.setRenderTarget(initPos);
      state.gl.render(sceneFBO.current, cameraFBO.current);
      simMaterial.current.uniforms.uCurrentPosition.value = initPos.texture;
    }

    // this.material.uniforms.time.value = this.time;

    // SIMULATION
    simMaterial.current.uniforms.uDirections.value = directions.texture;
    simMaterial.current.uniforms.uRenderMode.value = 0;
    geometry.current.setDrawRange(0, number);
    state.gl.setRenderTarget(renderTarget);
    state.gl.render(sceneFBO.current, cameraFBO.current);

    // BEGIN EMITTER
    const emit = 5;
    geometry.current.setDrawRange(currentParticles.current, emit);
    state.gl.autoClear = false;

    // DIRECTIONS
    simMaterial.current.uniforms.uRenderMode.value = 1;
    simMaterial.current.uniforms.uDirections.value = null;
    simMaterial.current.uniforms.uCurrentPosition.value = null;
    simMaterial.current.uniforms.uSource.value = new THREE.Vector3(0, 1, 0);
    state.gl.setRenderTarget(directions);
    state.gl.render(sceneFBO.current, cameraFBO.current);

    // POSITIONS
    simMaterial.current.uniforms.uRenderMode.value = 2;
    simMaterial.current.uniforms.uSource.value = new THREE.Vector3(0, 0, 0);
    state.gl.setRenderTarget(renderTarget);
    state.gl.render(sceneFBO.current, cameraFBO.current);
    simMaterial.current.uniforms.uCurrentPosition.value = initPos.texture;

    currentParticles.current += emit;
    if (currentParticles.current > number) {
      currentParticles.current = 0;
    }
    state.gl.autoClear = true;

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
  });
  return (
    <>
      {/* <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positionsF.current, 3]}
          />
          <bufferAttribute attach="attributes-uv" args={[uvsF.current, 2]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          uniforms={{
            time: { value: 0 },
            uTexture: { value: positionsF.current },
          }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          depthWrite={false}
          depthTest={false}
          transparent={true}
        />
      </points> */}
      {/* <mesh ref={debugPlane}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial map={threejsLogoTexture} />
      </mesh> */}
    </>
  );
};

export default Experience2;
