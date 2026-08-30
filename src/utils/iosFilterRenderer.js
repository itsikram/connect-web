/**
 * WebGL renderer for iOS-style camera filters.
 * One long-lived context per canvas. Draw video frames or stills with the same shader.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
uniform float uMirror;
uniform float uIntensity;
uniform float uVibrance;
uniform float uContrast;
uniform float uBrightness;
uniform float uSaturation;
uniform float uTemperature;
uniform float uTint;
uniform float uCrush;
uniform float uLift;
uniform float uClarity;
uniform float uVignette;
uniform float uGrain;
uniform float uGrayMode;
uniform vec2 uTexel;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 vibranceColor(vec3 c, float amount) {
  float l = luma(c);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / (mx + 1.0e-5);
  float boost = amount * (1.0 - sat);
  return mix(vec3(l), c, 1.0 + boost);
}

vec3 contrastCurve(vec3 c, float k) {
  vec3 x = clamp(c, 0.0, 1.0);
  vec3 s = x * x * (3.0 - 2.0 * x);
  vec3 mixed = mix(x, s, clamp(k * 1.35, 0.0, 1.0));
  return clamp((mixed - 0.5) * (1.0 + k * 1.15) + 0.5, 0.0, 1.0);
}

vec3 applyTemperature(vec3 c, float temp, float tint) {
  vec3 warm = vec3(1.06, 0.96, 0.82);
  vec3 cool = vec3(0.82, 0.94, 1.08);
  vec3 tcol = temp >= 0.0
    ? mix(vec3(1.0), warm, clamp(temp, 0.0, 1.0))
    : mix(vec3(1.0), cool, clamp(-temp, 0.0, 1.0));
  c *= tcol;
  c.r *= 1.0 + tint * 0.08;
  c.g *= 1.0 - tint * 0.1;
  c.b *= 1.0 - tint * 0.04;
  return c;
}

vec3 applyFilter(vec3 src, vec2 uv) {
  vec3 c = src;

  c = applyTemperature(c, uTemperature, uTint);
  c = vibranceColor(c, uVibrance);
  float l0 = luma(c);
  c = mix(vec3(l0), c, uSaturation);
  c = contrastCurve(c, uContrast);
  c += vec3(uBrightness);
  c = pow(max(c, 0.0), vec3(1.0 + uCrush));
  float l = luma(c);
  float shadow = 1.0 - smoothstep(0.0, 0.48, l);
  c += vec3(shadow * uLift);

  if (uClarity > 0.001) {
    vec3 blur =
      (texture2D(uTexture, uv + vec2(uTexel.x, 0.0)).rgb +
       texture2D(uTexture, uv - vec2(uTexel.x, 0.0)).rgb +
       texture2D(uTexture, uv + vec2(0.0, uTexel.y)).rgb +
       texture2D(uTexture, uv - vec2(0.0, uTexel.y)).rgb) * 0.25;
    c += (c - blur) * uClarity;
  }

  if (uGrayMode > 0.5) {
    float g = luma(c);
    vec3 bw = vec3(g);
    if (uGrayMode < 1.5) {
      bw = mix(bw, vec3(g * 0.96, g * 0.98, g * 1.04), 0.22);
    } else if (uGrayMode < 2.5) {
      float liftS = 1.0 - smoothstep(0.0, 0.55, g);
      bw = vec3(g + liftS * 0.08);
      bw = mix(bw, vec3(bw.r * 0.97, bw.g * 1.0, bw.b * 1.05), 0.18);
    } else {
      bw = contrastCurve(vec3(g), 0.15);
      bw = pow(bw, vec3(1.12));
    }
    c = bw;
  }

  if (uGrain > 0.001) {
    float n = hash(uv * vec2(1920.0, 1080.0)) - 0.5;
    c += n * uGrain;
  }

  if (uVignette > 0.001) {
    vec2 p = uv * 2.0 - 1.0;
    float v = dot(p, p);
    c *= 1.0 - uVignette * smoothstep(0.35, 1.65, v);
  }

  return clamp(c, 0.0, 1.0);
}

void main() {
  vec2 uv = (vUv - 0.5) * uUvScale + 0.5;
  if (uMirror > 0.5) {
    uv.x = 1.0 - uv.x;
  }
  vec3 original = texture2D(uTexture, uv).rgb;
  vec3 filtered = applyFilter(original, uv);
  vec3 outc = mix(original, filtered, clamp(uIntensity, 0.0, 1.0));
  gl_FragColor = vec4(outc, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "Shader compile failed");
  }
  return shader;
}

function coverScale(srcW, srcH, dstW, dstH, zoom) {
  const z = Math.max(zoom || 1, 1);
  if (!srcW || !srcH || !dstW || !dstH) return [1 / z, 1 / z];
  const srcAR = srcW / srcH;
  const dstAR = dstW / dstH;
  let u = 1;
  let v = 1;
  if (srcAR > dstAR) {
    u = dstAR / srcAR;
  } else {
    v = srcAR / dstAR;
  }
  return [u / z, v / z];
}

const IDENTITY = {
  vibrance: 0,
  contrast: 0,
  brightness: 0,
  saturation: 1,
  temperature: 0,
  tint: 0,
  crush: 0,
  lift: 0,
  clarity: 0,
  vignette: 0,
  grain: 0,
  grayMode: 0,
};

export default class IosFilterRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.buffer = null;
    this.texture = null;
    this.locs = {};
    this.srcW = 1;
    this.srcH = 1;
    this.zoom = 1;
    this.mirror = 0;
    this.intensity = 1;
    this.params = { ...IDENTITY };
    this._init();
  }

  _init() {
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL is required for camera filters");
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
    }
    gl.useProgram(program);
    this.program = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.buffer = buffer;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.texture = texture;

    const names = [
      "uTexture",
      "uUvScale",
      "uMirror",
      "uIntensity",
      "uVibrance",
      "uContrast",
      "uBrightness",
      "uSaturation",
      "uTemperature",
      "uTint",
      "uCrush",
      "uLift",
      "uClarity",
      "uVignette",
      "uGrain",
      "uGrayMode",
      "uTexel",
    ];
    names.forEach((n) => {
      this.locs[n] = gl.getUniformLocation(program, n);
    });
    gl.uniform1i(this.locs.uTexture, 0);
  }

  isReady() {
    return Boolean(this.gl && this.program);
  }

  setSourceSize(w, h) {
    this.srcW = w || 1;
    this.srcH = h || 1;
  }

  setZoom(z) {
    this.zoom = Math.max(1, Number(z) || 1);
  }

  setMirror(on) {
    this.mirror = on ? 1 : 0;
  }

  setFilter(params, intensity) {
    this.params = { ...IDENTITY, ...(params || {}) };
    this.intensity = Math.max(0, Math.min(1, (Number(intensity) || 0) / 100));
  }

  resize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  _upload(source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      // Ignore empty video frames
    }
  }

  _setUniforms() {
    const gl = this.gl;
    const p = this.params;
    const [sx, sy] = coverScale(
      this.srcW,
      this.srcH,
      this.canvas.width,
      this.canvas.height,
      this.zoom
    );
    gl.uniform2f(this.locs.uUvScale, sx, sy);
    gl.uniform1f(this.locs.uMirror, this.mirror);
    gl.uniform1f(this.locs.uIntensity, this.intensity);
    gl.uniform1f(this.locs.uVibrance, p.vibrance);
    gl.uniform1f(this.locs.uContrast, p.contrast);
    gl.uniform1f(this.locs.uBrightness, p.brightness);
    gl.uniform1f(this.locs.uSaturation, p.saturation);
    gl.uniform1f(this.locs.uTemperature, p.temperature);
    gl.uniform1f(this.locs.uTint, p.tint);
    gl.uniform1f(this.locs.uCrush, p.crush);
    gl.uniform1f(this.locs.uLift, p.lift);
    gl.uniform1f(this.locs.uClarity, p.clarity);
    gl.uniform1f(this.locs.uVignette, p.vignette);
    gl.uniform1f(this.locs.uGrain, p.grain);
    gl.uniform1f(this.locs.uGrayMode, p.grayMode);
    gl.uniform2f(
      this.locs.uTexel,
      1 / Math.max(this.srcW, 1),
      1 / Math.max(this.srcH, 1)
    );
  }

  draw(source) {
    if (!source || !this.gl) return;
    const gl = this.gl;
    this._upload(source);
    this._setUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  async captureBlob(source, { width, height, quality = 0.92, mime = "image/jpeg" } = {}) {
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    const prevMirror = this.mirror;
    this.resize(width, height);
    this.setMirror(false);
    this.draw(source);
    const blob = await new Promise((resolve) => {
      this.canvas.toBlob((b) => resolve(b), mime, quality);
    });
    this.setMirror(prevMirror);
    this.resize(prevW, prevH);
    return blob;
  }

  toDataURL(quality = 0.7) {
    return this.canvas.toDataURL("image/jpeg", quality);
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    try {
      gl.deleteTexture(this.texture);
      gl.deleteBuffer(this.buffer);
      gl.deleteProgram(this.program);
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    } catch {
      /* ignore */
    }
    this.gl = null;
  }
}

export { coverScale };
