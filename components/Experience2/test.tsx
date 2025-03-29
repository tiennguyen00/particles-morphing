import { lerp } from "three/src/math/MathUtils";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFBO, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  fragmentShader,
  simFragment,
  simVertex,
  vertexShader,
} from "@/shaders/index2";
import { useScreen } from "@/hooks/useScreen";

const Experience2 = () => {
  const size = 64,
    number = size * size;
  const init = useRef(false);
  const { width, height } = useScreen();
  const currentParticles = useRef(0);
  const dataFBO = useRef<THREE.DataTexture>(null!);

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

  const simMaterial = useRef<THREE.ShaderMaterial>(null!);
  const simGeometry = useRef<THREE.BufferGeometry>(null!);
  const material = useRef<THREE.ShaderMaterial>(null!);
  const debugPlane = useRef<
    THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  >(null!);
  const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const { scene, camera, pointer } = useThree();
  const threejsLogoTexture = useTexture("/img/threejs-logo.png");

  const getPointsOnSphere = useMemo(() => {
    const data = new Float32Array(4 * number);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;

        // generate point on a sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
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

    return { dataTexture };
  }, []);

  const setUpFBO1 = () => {
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
        uCurrentPosition: { value: getPointsOnSphere.dataTexture },
        uDirections: { value: null },
      },
      vertexShader: simVertex,
      fragmentShader: simFragment,
    });
    simMaterial.current.needsUpdate = true;
    const simMesh = new THREE.Points(simGeometry.current, simMaterial.current);
    sceneFBO.current.add(simMesh);

    return { positions };
  };

  useEffect(() => {
    setUpFBO1();
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
  // const renderTargetRef = useRef({
  //   current: renderTargetA,
  //   next: renderTargetB,
  // });

  useEffect(() => {
    const planeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 30, 30),
      new THREE.MeshBasicMaterial()
    );
    const dummy = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 32, 32),
      new THREE.MeshNormalMaterial()
    );
    const handleMouseMove = (e: MouseEvent) => {
      pointer.x = (e.clientX / width) * 2 - 1;
      pointer.y = -(e.clientY / height) * 2 + 1;
      raycaster.current.setFromCamera(pointer, camera);

      const intersects = raycaster.current.intersectObjects([planeMesh]);
      if (!simMaterial.current) return;
      if (intersects.length > 0) {
        dummy.position.copy(intersects[0].point);
        simMaterial.current.uniforms.uMouse.value = intersects[0].point;
      }
    };

    scene.add(dummy);

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      scene.remove(dummy);
    };
  }, [width, height]);

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
    simGeometry.current.setDrawRange(0, number);
    state.gl.setRenderTarget(renderTarget);
    state.gl.render(sceneFBO.current, cameraFBO.current);

    // BEGIN EMITTER
    const emit = 5;
    simGeometry.current.setDrawRange(currentParticles.current, emit);
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

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          uniforms={{
            time: { value: 0 },
            uTexture: { value: positions },
          }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          depthWrite={false}
          depthTest={false}
          transparent={true}
        />
      </points>
      <mesh ref={debugPlane}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial map={threejsLogoTexture} />
      </mesh>
    </>
  );
};

export default Experience2;
