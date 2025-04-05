/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import { horseVertexShader, horseFragmentShader } from "./index";
import * as THREE from "three";

const HorseMaterial = shaderMaterial(
  {
    uPositions: { value: null },
    uSize: { value: 2 },
    uTime: { value: 0 },
    uScroll: { value: 0 },
  },
  horseVertexShader,
  horseFragmentShader
);

extend({ HorseMaterial });
