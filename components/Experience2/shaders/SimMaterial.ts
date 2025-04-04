/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import { simVertex, simFragment } from "./index";
import * as THREE from "three";

const SimMaterial = shaderMaterial(
  {
    time: new THREE.Uniform(0),
    uMouse: new THREE.Uniform(new THREE.Vector3(0, 0, 0)),
    uProgress: new THREE.Uniform(0),
    uTime: new THREE.Uniform(0),
    uSource: new THREE.Uniform(new THREE.Vector3(0, 0, 0)),
    uRenderMode: new THREE.Uniform(0),
    uCurrentPosition: new THREE.Uniform(null),
    uDirections: new THREE.Uniform(null),
  },
  simVertex,
  simFragment
);

extend({ SimMaterial });
