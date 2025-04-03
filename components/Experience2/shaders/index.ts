export const simVertex = `
varying vec2 vUv;
uniform float time;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_PointSize = 1.;
    gl_Position = projectionMatrix * mvPosition;
}

`;

export const simFragment = `
varying vec2 vUv;
uniform float uProgress;
uniform int uRenderMode;
uniform vec3 uSource;
uniform sampler2D uCurrentPosition;
uniform sampler2D uDirections;
uniform vec3 uMouse;
uniform float uTime;
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    float offset = rand(vUv);
    vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
    vec4 direction = texture2D( uDirections, vUv );

    if(uRenderMode==0){
        float life = 1. - clamp( (uTime - direction.a)/15., 0.,1.);
        float speedlife = clamp(life,0.1,1.);
        position.xyz = position.xyz + speedlife*direction.xyz * 0.01 + vec3(0.,-1,0.)*0.005 + vec3(0.,0.,-1.)*0.01;

        gl_FragColor = vec4( position, life);
    }

    // DIRECTIONS
    if(uRenderMode==1){
        float rnd1 = rand(vUv) - 0.5;
        float rnd2 = rand(vUv + vec2(0.1,0.1)) - 0.5;
        float rnd3 = rand(vUv + vec2(0.3,0.3)) - 0.5;
        gl_FragColor = vec4( uSource + vec3(rnd1,rnd2,rnd3)*0.9, uTime);
    }

    // POSITIONS
    if(uRenderMode==2){
        float rnd1 = rand(vUv) - 0.5;
        float rnd2 = rand(vUv + vec2(0.1,0.1)) - 0.5;
        float rnd3 = rand(vUv + vec2(0.3,0.3)) - 0.5;
        gl_FragColor = vec4( uSource + vec3(rnd1,rnd2,rnd3)*0.9, 1.);
    }
}
`;

export const vertexShader = `
varying vec2 vUv;
varying float vLife;
uniform float time;

uniform sampler2D uTexture;

void main() {

    vUv = uv;
    vec3 newpos = position;
    vec4 simPosition = texture2D( uTexture, vUv );
    newpos.xyz = simPosition.xyz;
    vLife = simPosition.w;
    // newpos.x += 1.;
    // newpos.z += sin( time + position.x*10. ) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );

    gl_PointSize =  5.*( 2.0 / -mvPosition.z );

    gl_Position = projectionMatrix * mvPosition;

}

`;
export const fragmentShader = `
varying vec2 vUv;
uniform sampler2D uTexture;
varying float vLife;
void main() {
    if(vLife<0.001) discard;
    vec4 color = texture2D( uTexture, vUv );
    gl_FragColor = vec4( 0.83, 0.65, 0.89, 0.8*vLife );
    // gl_FragColor = color;
}
`;
