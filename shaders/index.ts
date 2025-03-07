export const vertexShader = `
uniform float uTime;
varying vec2 vUv;

void main() {
  vec3 newPos = position;
  newPos.z += sin(uTime + newPos.x * 10.0) * 0.1;

  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
  gl_PointSize = 10. / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
} 
`;

export const fragmentShader = `
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}

`;
