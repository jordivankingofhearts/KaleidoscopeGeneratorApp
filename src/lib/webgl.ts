const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

const float TWO_PI = 6.28318530717958647693;

uniform sampler2D u_tex;
uniform int u_segments;
uniform float u_rotation;
uniform vec2 u_center;
uniform float u_outAspect;
uniform float u_srcAspect;
uniform int u_mirror;
uniform int u_reverse;
uniform vec2 u_srcCenter;
uniform float u_srcZoom;
uniform float u_srcRot;
uniform int u_radialWrap;
uniform float u_radialScale;
uniform int u_wrapMode;
uniform int u_hasTex;
uniform float u_time;

in vec2 v_uv;
out vec4 fragColor;

// Mirror-repeat: maps t ∈ (-∞,∞) to [0,1] with period-2 triangle wave
float mirrorFold(float t) {
  return 1.0 - abs(fract(t * 0.5) * 2.0 - 1.0);
}

// Triangle-wave radial fold: r → [0, scale] with period 2·scale
float radialFold(float r, float s) {
  return s * (1.0 - abs(fract(r / (2.0 * s)) * 2.0 - 1.0));
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec4 sampleTex(vec2 uv) {
  if (u_wrapMode == 0) {
    return texture(u_tex, clamp(uv, 0.001, 0.999));
  } else if (u_wrapMode == 1) {
    return texture(u_tex, fract(uv));
  } else {
    return texture(u_tex, vec2(mirrorFold(uv.x), mirrorFold(uv.y)));
  }
}

void main() {
  // Aspect-corrected offset from center
  vec2 p = v_uv - u_center;
  p.x *= u_outAspect;

  float r = length(p);

  if (u_hasTex == 0) {
    // Animated demo when no source is loaded
    float seg = TWO_PI / 8.0;
    float theta = atan(p.y, p.x);
    float a = mod(theta + u_time * 0.15, seg);
    a = min(a, seg - a);
    float fold = radialFold(r, 0.38);
    float hue = a / seg * 0.4 + fold * 1.2 + u_time * 0.06;
    float val = 0.06 + fold * fold * 0.25;
    fragColor = vec4(hsv2rgb(vec3(hue, 0.75, val)), 1.0);
    return;
  }

  if (r < 0.0001) {
    fragColor = sampleTex(u_srcCenter);
    return;
  }

  float theta = atan(p.y, p.x);
  if (u_reverse != 0) theta = -theta;

  // Kaleidoscope fold into one segment wedge
  float segAngle = TWO_PI / float(u_segments);
  float a = mod(theta - u_rotation, segAngle);
  if (a < 0.0) a += segAngle;
  if (u_mirror != 0) a = min(a, segAngle - a);

  // Radial triangle-wave wrap
  float rs = r;
  if (u_radialWrap != 0 && u_radialScale > 0.001) {
    rs = radialFold(r, u_radialScale);
  }

  // 2D sample direction in aspect-corrected space
  vec2 d = vec2(cos(a), sin(a)) * rs;

  // Apply source rotation
  float cosR = cos(u_srcRot);
  float sinR = sin(u_srcRot);
  d = vec2(d.x * cosR - d.y * sinR, d.x * sinR + d.y * cosR);

  // Map to source UV (divide x by srcAspect to account for non-square source)
  vec2 srcUV = u_srcCenter + vec2(d.x / u_srcAspect, d.y) * u_srcZoom;
  fragColor = sampleTex(srcUV);
}`;

export interface GLState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  texture: WebGLTexture;
  locs: Record<string, WebGLUniformLocation | null>;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile error:\n${log}`);
  }
  return s;
}

export function initGL(canvas: HTMLCanvasElement): GLState {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext;

  if (!gl) throw new Error('WebGL2 not supported in this browser');

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Link error: ${gl.getProgramInfoLog(program)}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  // Fullscreen quad (2 triangles)
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );
  const posLoc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Default 1×1 texture
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([100, 0, 150, 255])
  );

  // Cache all uniform locations once
  const uniformNames = [
    'u_tex', 'u_segments', 'u_rotation', 'u_center', 'u_outAspect',
    'u_srcAspect', 'u_mirror', 'u_reverse', 'u_srcCenter', 'u_srcZoom',
    'u_srcRot', 'u_radialWrap', 'u_radialScale', 'u_wrapMode', 'u_hasTex', 'u_time',
  ];
  const locs: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) locs[name] = gl.getUniformLocation(program, name);

  return { gl, program, vao, texture, locs };
}

export interface RenderParams {
  segments: number;
  rotation: number;       // radians
  centerX: number;        // 0–1 UV (x increases right)
  centerY: number;        // 0–1 UV (y=0 bottom in WebGL convention)
  outputAspect: number;   // width / height
  sourceAspect: number;   // width / height of source texture
  mirror: boolean;
  reverse: boolean;
  sourceCenterX: number;  // 0–1
  sourceCenterY: number;  // 0–1
  sourceZoom: number;     // effective shader scale (pre-computed)
  sourceRot: number;      // radians
  radialWrap: boolean;
  radialScale: number;    // in aspect-corrected screen units
  wrapMode: number;       // 0=clamp 1=repeat 2=mirror
  hasSource: boolean;
  quality: 'draft' | 'high';
  time: number;           // seconds, for demo animation
}

export function renderFrame(state: GLState, p: RenderParams): void {
  const { gl, program, vao, texture, locs: L } = state;

  gl.viewport(0, 0, (gl.canvas as HTMLCanvasElement).width, (gl.canvas as HTMLCanvasElement).height);
  gl.clearColor(0.035, 0.035, 0.04, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const minFilter = p.quality === 'high' ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST;
  const magFilter = p.quality === 'high' ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);

  gl.uniform1i(L.u_tex, 0);
  gl.uniform1i(L.u_segments, p.segments);
  gl.uniform1f(L.u_rotation, p.rotation);
  gl.uniform2f(L.u_center, p.centerX, p.centerY);
  gl.uniform1f(L.u_outAspect, p.outputAspect);
  gl.uniform1f(L.u_srcAspect, p.sourceAspect || 1);
  gl.uniform1i(L.u_mirror, p.mirror ? 1 : 0);
  gl.uniform1i(L.u_reverse, p.reverse ? 1 : 0);
  gl.uniform2f(L.u_srcCenter, p.sourceCenterX, p.sourceCenterY);
  gl.uniform1f(L.u_srcZoom, Math.max(0.001, p.sourceZoom));
  gl.uniform1f(L.u_srcRot, p.sourceRot);
  gl.uniform1i(L.u_radialWrap, p.radialWrap ? 1 : 0);
  gl.uniform1f(L.u_radialScale, Math.max(0.001, p.radialScale));
  gl.uniform1i(L.u_wrapMode, p.wrapMode);
  gl.uniform1i(L.u_hasTex, p.hasSource ? 1 : 0);
  gl.uniform1f(L.u_time, p.time);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
}

export function loadTexture(state: GLState, image: HTMLImageElement): void {
  const { gl, texture } = state;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image top-left → UV(0,1)=top
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}
