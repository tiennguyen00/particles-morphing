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
uniform sampler2D uCurrentPosition;
uniform sampler2D uOriginalPosition;
uniform sampler2D uOriginalPosition1;
uniform vec3 uMouse;
uniform float uTime;
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    float offset = rand(vUv);
    vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
    vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
    vec3 original1 = texture2D( uOriginalPosition1, vUv ).xyz;

    // vec2 velocity = texture2D( uCurrentPosition, vUv ).zw;

    vec3 finalOriginal = original;

    // velocity *= 0.99;

    // particle attraction to shape force
    vec3 direction = normalize( finalOriginal - position );
    float dist = length( finalOriginal - position );
    if( dist > 0.01 ) {
        position += direction  * 0.001;
    }
    
    // mouse repel force
    float mouseDistance = distance( position, uMouse );
    float maxDistance = 0.3;
    if( mouseDistance < maxDistance ) {
        vec3 direction = normalize( position - uMouse );
        position += direction * ( 1.0 - mouseDistance / maxDistance ) * 0.1;
    }


    // lifespan of a particle
    float lifespan = 10.;
    float age = mod( uTime+ lifespan*offset, lifespan );
    if(age<0.1){
        // velocity = vec2(0.0,0.001);
        position.xyz = finalOriginal;
    }



    // position.xy += velocity;
    gl_FragColor = vec4( position, 1.);
}
`;

export const vertexShader = `
varying vec2 vUv;
uniform float time;

uniform sampler2D uTexture;

void main() {

    vUv = uv;
    vec3 newpos = position;
    vec4 color = texture2D( uTexture, vUv );
    newpos.xyz = color.xyz;
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
void main() {
    vec4 color = texture2D( uTexture, vUv );
    gl_FragColor = vec4( 1.,1.,1., 1. );
    // gl_FragColor = color;
}
`;
