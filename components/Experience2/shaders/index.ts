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
    gl_FragColor = vec4( 0.83, 0.65, 0.89, 0.6*vLife );
    // gl_FragColor = color;
}
`;

export const horseVertexShader = `
attribute vec3 aE2Geometry;
uniform sampler2D uPositions;//RenderTarget containing the transformed positions
uniform float uSize;
uniform float uTime;
varying vec3 vPos;
varying vec2 vUv;

uniform float size;
uniform float scale;
uniform float uScroll;

#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_POINTS_UV

varying vec2 vUv;
uniform mat3 uvTransform;

#endif

mat4 rotationMatrix(vec3 axis, float angle)
{
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
              oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
              oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
              0.0,                                0.0,                                0.0,                                1.0);
}

void main() {

  #ifdef USE_POINTS_UV

  vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

  #endif

  #include <color_vertex>
  #include <morphcolor_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>



  #ifdef USE_SIZEATTENUATION

  bool isPerspective = isPerspectiveMatrix( projectionMatrix );

  if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );

  #endif

  vec4 originalPos = projectionMatrix * modelViewMatrix * vec4( aE2Geometry, 1.0 );

  transformed.y -= 60.3;

  vec4 transformedPos = projectionMatrix * modelViewMatrix * rotationMatrix(vec3(0., -1.0, 0.0), sin(uTime) + sin(uTime) * 0.1 + 3.14)  * vec4( transformed.xyz * 0.01, 1.0 );;


  if (uScroll < uRange) {
    gl_Position.w = 0.0;
  } else if (uScroll < uRange * 2.0) {
    gl_Position.w = 0.0;
  } else if (uScroll < uRange * 3.0) {
    gl_PointSize = mix(0.0, uSize, (uScroll - uRange * 2.0) * uTotalModels );
    gl_Position = mix( originalPos, transformedPos, (uScroll - uRange * 2.0) * uTotalModels );
  } else {
    float scroll = max((uScroll - uRange * 3.0), (uScroll - uRange * 3.0) * uTotalModels);
    gl_PointSize = mix(uSize, 0.0, scroll);
    originalPos.x -= 2.;
    gl_Position = mix( transformedPos, originalPos, scroll);
  }

  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  #include <worldpos_vertex>
  #include <fog_vertex>

  vPos = mvPosition.xyz;
  //vPos = transformed;
}
`;

export const horseFragmentShader = `
varying vec3 vPos;
uniform float uTime;
uniform float uScroll;
void main()
{
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  float strength = 0.05 / distanceToCenter - 0.1;
  float opacity = 0.0;

  if (uScroll < uRange) {
    opacity = 0.0;
  } else if (uScroll < uRange * 2.0) {
    opacity = 0.0;
  } else if (uScroll < uRange * 3.0) {
    opacity = mix(0.0, 1.0, (uScroll - uRange * 2.0) * uTotalModels );
  } else {
    opacity = mix(1.0, 0.0, (uScroll - uRange * 3.0) * uTotalModels );
  }

  // set FireFilies orange Color
  gl_FragColor = vec4(1.0, 0.5, 0.0, strength * length(vPos) * opacity);
}

`;
