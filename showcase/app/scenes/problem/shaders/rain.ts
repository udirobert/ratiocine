import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";

const rainFragmentShader = /* glsl */ `
  uniform vec2 resolution;
  uniform float intensity;

  #define S(a, b, t) smoothstep(a, b, t)

  vec3 N13(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3(
      (p3.x + p3.y) * p3.z,
      (p3.x + p3.z) * p3.y,
      (p3.y + p3.z) * p3.x
    ));
  }

  float N(float t) { return fract(sin(t * 12345.564) * 7658.76); }
  float Saw(float b, float t) { return S(0.0, b, t) * S(1.0, b, t); }

  vec2 DropLayer2(vec2 uv, float t) {
    vec2 uvBase = uv;
    uv.y += t * 0.75;
    vec2 a = vec2(6.0, 1.0);
    vec2 grid = a * 2.0;
    vec2 id = floor(uv * grid);
    float colShift = N(id.x);
    uv.y += colShift;
    id = floor(uv * grid);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
    vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
    float x = n.x - 0.5;
    float y = uvBase.y * 20.0;
    float wiggle = sin(y + sin(y));
    x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
    x *= 0.7;
    float ti = fract(t + n.z);
    y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
    vec2 p = vec2(x, y);
    float d = length((st - p) * a.yx);
    float mainDrop = S(0.4, 0.0, d);
    float r = sqrt(S(1.0, y, st.y));
    float cd = abs(st.x - x);
    float trail = S(0.23 * r, 0.15 * r * r, cd);
    float trailFront = S(-0.02, 0.02, st.y - y);
    trail *= trailFront * r * r;
    y = uvBase.y;
    float trail2 = S(0.2 * r, 0.0, cd);
    float droplets = max(0.0, (sin(y * (1.0 - y) * 120.0) - st.y)) * trail2 * trailFront * n.z;
    y = fract(y * 10.0) + (st.y - 0.5);
    float dd = length(st - vec2(x, y));
    droplets = S(0.3, 0.0, dd);
    float mask = mainDrop + droplets * r * trailFront;
    return vec2(mask, trail);
  }

  float StaticDrops(vec2 uv, float t) {
    uv *= 40.0;
    vec2 id = floor(uv);
    uv = fract(uv) - 0.5;
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - 0.5) * 0.7;
    float d = length(uv - p);
    float fade = Saw(0.025, fract(t + n.z));
    return S(0.3, 0.0, d) * fract(n.z * 10.0) * fade;
  }

  vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t) * l0;
    vec2 m1 = DropLayer2(uv, t) * l1;
    vec2 m2 = DropLayer2(uv * 1.85, t) * l2;
    float c = s + m1.x + m2.x;
    c = S(0.3, 1.0, c);
    return vec2(c, max(m1.y * l0, m2.y * l1));
  }

  vec3 sampleScene(vec2 uv) { return texture(inputBuffer, uv).rgb; }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 aspectUv = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
    float t = time * 0.15;
    float dropScale = clamp(min(resolution.x, resolution.y) / 900.0, 0.75, 1.35);
    vec2 scaledUv = aspectUv * dropScale;
    float rainAmount = clamp(intensity, 0.0, 1.25);
    float staticDrops = S(-0.5, 1.0, rainAmount) * 2.0;
    float layer1 = S(0.25, 0.75, rainAmount);
    float layer2 = S(0.0, 0.5, rainAmount);
    vec2 c = Drops(scaledUv, t, staticDrops, layer1, layer2);
    vec2 e = vec2(1.5 / resolution.x, 0.0);
    float cx = Drops(scaledUv + e * dropScale, t, staticDrops, layer1, layer2).x;
    float cy = Drops(scaledUv + e.yx * dropScale, t, staticDrops, layer1, layer2).x;
    vec2 normal = vec2(cx - c.x, cy - c.x);
    vec2 refractedUv = clamp(uv + normal * 0.6, vec2(0.001), vec2(0.999));
    vec3 col = sampleScene(refractedUv);
    vec2 vignetteUv = uv - 0.5;
    col *= 1.0 - dot(vignetteUv, vignetteUv) * 0.7;
    outputColor = vec4(col, inputColor.a);
  }
`;

export class RainEffect extends Effect {
  constructor() {
    super("RainEffect", rainFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ["resolution", new Uniform(new Vector2(1, 1))],
        ["intensity", new Uniform(0.9)],
      ]),
    });
  }

  setSize(width: number, height: number) {
    this.uniforms.get("resolution")!.value.set(width, height);
  }
}
