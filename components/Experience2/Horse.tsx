/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useGLTF, useAnimations } from "@react-three/drei";
import "./shaders/HorseMaterial";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const Horse = () => {
  const refPoints = useRef<THREE.Points>(null);
  const { scene: scene1, animations } = useGLTF("/models/horse.glb");
  scene1.scale.set(0.01, 0.01, 0.01);
  const { actions, clips, mixer } = useAnimations(animations, scene1);

  useEffect(() => {
    if (refPoints.current && scene1.children.length > 0) {
      const childMesh = scene1.children[0];
      if (childMesh.geometry && childMesh.geometry.attributes.position) {
        const newGeometry = new THREE.BufferGeometry();

        newGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(
            childMesh.geometry.attributes.position.array,
            3
          )
        );

        newGeometry.morphAttributes.position =
          childMesh.geometry.morphAttributes.position;

        newGeometry.morphTargetsRelative =
          childMesh.geometry.morphTargetsRelative;

        refPoints.current.geometry.dispose();
        refPoints.current.geometry = newGeometry;

        // Set the morph target properties correctly
        refPoints.current.morphTargetInfluences =
          childMesh.morphTargetInfluences;
        refPoints.current.morphTargetDictionary =
          childMesh.morphTargetDictionary;
      }
    }

    // Start the animation
    if (clips.length > 0) {
      mixer.clipAction(clips[0]).play();
    }
  }, []);

  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta);

      // Manually update point morphs from the original mesh if needed
      if (refPoints.current && scene1.children.length > 0) {
        const childMesh = scene1.children[0];
        if (
          childMesh.morphTargetInfluences &&
          refPoints.current.morphTargetInfluences
        ) {
          for (let i = 0; i < childMesh.morphTargetInfluences.length; i++) {
            refPoints.current.morphTargetInfluences[i] =
              childMesh.morphTargetInfluences[i];
          }
        }
      }
    }
  });

  return (
    <>
      {/* Keep the original mesh for animation but make it invisible */}

      <points ref={refPoints} scale={[0.1, 0.1, 0.1]} position={[0, -15, 2.3]}>
        <pointsMaterial size={0.1} color="#D18B47" morphTargets={true} />
      </points>
    </>
  );
};

export default Horse;
