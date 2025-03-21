export const vertexInstance = `
varying vec2 vUv;
uniform float time;
attribute vec2 uvRef;

uniform sampler2D uTexture;
uniform sampler2D uVelocity;
varying vec3 vNormal;
varying vec3 vViewPosition;

vec3 rotate3D(vec3 v, vec3 vel) {
    vec3 newpos = v;
    vec3 up = vec3(0, 1, 0);
    vec3 axis = normalize(cross(up, vel));
    float angle = acos(dot(up, normalize(vel)));
    newpos = newpos * cos(angle) + cross(axis, newpos) * sin(angle) + axis * dot(axis, newpos) * (1.0 - cos(angle));
    
    return newpos;
}

void main() {
    vUv = uv;
    vec4 color = texture2D( uTexture, uvRef );
    vec4 velocity = texture2D( uVelocity, uvRef );
    vec3 newpos = color.xyz;

    vec3 transformed = position.xyz;
    if(length(velocity.xyz) < 0.0001) {
        velocity.xyz = vec3(0.0, 0.0001, 0.0001);
    }
    transformed.y *= max(1., length(velocity.xyz)*1000.);
    transformed = rotate3D(transformed, velocity.xyz);
    vNormal =  rotate3D(normal, velocity.xyz);

    mat4 instanceMat = instanceMatrix;

    instanceMat[3].x = newpos.x;
    instanceMat[3].y = newpos.y;
    instanceMat[3].z = newpos.z;
    
    vec4 mvPosition = modelViewMatrix * instanceMat * vec4( transformed, 1.0 );
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
}
`;

export const fragmentShader = `
varying vec2 vUv;
uniform sampler2D uTexture;
varying vec3 vNormal;
uniform sampler2D uMatcap;
varying vec3 vViewPosition;

void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 x = normalize(vec3(viewDir.z, 0., -viewDir.x));
    vec3 y = cross(viewDir, x);
    vec2 sphereUv = vec2(dot(x, vNormal), dot(y, vNormal)) * 0.495 + 0.5;

    vec4 matcapColor = texture2D(uMatcap, sphereUv);

    vec4 color = texture2D( uTexture, vUv );
    gl_FragColor = vec4( vNormal, 1.0 );
    gl_FragColor = matcapColor;
}
`;

export const simVertex = `
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const simFragmentPosition = `
uniform float uProgress;
uniform vec3 uMouse;
uniform float uTime;
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    // Normally, a 3D model would provide vUv from the vertex shader.
    // However, in this case, we’re not rendering a model—we are working in screen space.
    // That’s why we use gl_FragCoord.xy / resolution.xy:
    vec2 vUv = gl_FragCoord.xy / resolution.xy;
    
    float offset = rand(vUv);
    vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
    vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

    position += velocity;

    gl_FragColor = vec4( position, 1.);
}
`;

export const simFragmentVelocity = `
uniform float uProgress;
// uniform sampler2D uCurrentPosition;
uniform sampler2D uOriginalPosition;
uniform vec3 uMouse;
uniform float uTime;
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    vec2 vUv = gl_FragCoord.xy / resolution.xy;
    float offset = rand(vUv);
    vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
    vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
    vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

    velocity *= 0.9;

    // particle attraction to shape force
    vec3 direction = normalize( original - position );
    float dist = length( original - position );
    if( dist > 0.1 ) {
        velocity += direction  * 0.001;
    }
    



    // mouse repel force
    float mouseDistance = distance( position, uMouse );
    float maxDistance = 0.25;
    if( mouseDistance < maxDistance ) {
        vec3 direction = normalize( position - uMouse );
        velocity += direction * ( 1.0 - mouseDistance / maxDistance ) * 0.01;
    }


    // lifespan of a particle
    // float lifespan = 10.;
    // float age = mod( uTime+ lifespan*offset, lifespan );
    // if(age<0.1){
    //     // velocity = vec2(0.0,0.001);
    //     position.xyz = finalOriginal;
    // }



    // position.xy += velocity;

    
    gl_FragColor = vec4(velocity, 1.);
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

    gl_PointSize =  ( 2.0 / -mvPosition.z );

    gl_Position = projectionMatrix * mvPosition;

}

`;
