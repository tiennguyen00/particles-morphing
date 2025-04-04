/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import { vertexShader, fragmentShader } from "./index";
import * as THREE from "three";

const RenderMaterial = shaderMaterial(
  {
    time: new THREE.Uniform(0),
    uTexture: new THREE.Uniform(null),
  },
  vertexShader,
  fragmentShader
);

extend({ RenderMaterial });
