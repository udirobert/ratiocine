import { ShaderMaterial } from "three";

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
uniform float curve;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 mod289(vec3 x) { return x - floor(x*(1./289.))*289.; }
vec2 mod289(vec2 x) { return x - floor(x*(1./289.))*289.; }
vec3 permute(vec3 x) { return mod289(((x*34.)+1.)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i = floor(v+dot(v,C.yy));
  vec2 x0 = v-i+dot(i,C.xx);
  vec2 i1 = (x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12 = x0.xyxy+C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m = max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m = m*m; m = m*m;
  vec3 x = 2.*fract(p*C.www)-1.;
  vec3 h = abs(x)-.5;
  vec3 ox = floor(x+.5);
  vec3 a0 = x-ox;
  m *= 1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x = a0.x*x0.x+h.x*x0.y;
  g.yz = a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

void main() {
  vec2 uv = vUv;
  vec2 curveUV = uv*2.-1.;
  vec2 offset = curveUV.yx*curve;
  curveUV += curveUV*offset*offset;
  curveUV = curveUV*.5+.5;
  uv = curveUV;

  float time = uTime*2.;
  float noise = max(0.,snoise(vec2(time,uv.y*.3))-.3)*(1./.95);
  noise += (snoise(vec2(time*10.,uv.y*2.4))-.5)*.06;
  float xpos = uv.x-noise*noise*.1;
  vec4 col = texture2D(map,vec2(xpos,uv.y));
  col.rgb = mix(col.rgb,vec3(rand(vec2(uv.y*time))),noise*.25);
  if(floor(mod(uv.y*.25*200.,2.))==0.) col.rgb *= 1.-(0.07*noise);
  col.g = mix(col.r,texture2D(map,vec2(xpos,uv.y)).g,.1);
  col.b = mix(col.r,texture2D(map,vec2(xpos,uv.y)).b,.1);
  vec2 edge = smoothstep(0.,.05,curveUV)*(1.-smoothstep(1.-.05,1.,curveUV));
  col.rgb *= edge.x*edge.y;
  gl_FragColor = col;
}
`;

export const crtMaterial = new ShaderMaterial({
  vertexShader: vert,
  fragmentShader: frag,
  uniforms: {
    map: { value: null },
    uTime: { value: 0 },
    curve: { value: 0.2 },
  },
});
