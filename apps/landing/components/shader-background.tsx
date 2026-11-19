"use client";

import { useEffect, useRef, useState } from "react";
import { prefersStaticMotion } from "./motion-env";

/**
 * Hero background: a custom GLSL fragment shader on a fullscreen triangle —
 * domain-warped fbm noise flowing through the brand palette (red on black,
 * cream highlights). No shader libraries involved.
 *
 * Degradation:
 * - No WebGL / context lost -> static CSS gradient fallback.
 * - prefers-reduced-motion  -> exactly one shader frame, no loop.
 * - Offscreen / hidden tab  -> animation paused.
 */

const VERT_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(7.31, 3.17);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.10;

  // two-warp domain: q distorts the lookup of the main field
  vec2 q = vec2(
    fbm(uv * 1.4 + vec2(t, -t * 0.6)),
    fbm(uv * 1.4 + vec2(-t * 0.7, t * 0.9) + 5.2)
  );
  float n = fbm(uv * 2.1 + q * 1.35 + vec2(0.0, t * 1.2));

  vec3 ink   = vec3(0.039, 0.039, 0.039);  // #0A0A0A
  vec3 red   = vec3(0.784, 0.063, 0.180);  // #C8102E
  vec3 deep  = vec3(0.557, 0.043, 0.125);  // #8E0B20
  vec3 cream = vec3(1.000, 0.973, 0.933);  // #FFF8EE

  float band = smoothstep(0.32, 0.88, n);
  vec3 col = mix(ink, deep, band);
  col = mix(col, red, pow(band, 2.2) * 0.85);
  col += cream * pow(smoothstep(0.62, 0.98, n), 3.0) * 0.28;

  // vignette keeps the headline area dark and readable
  float vig = smoothstep(1.25, 0.30, length(uv + vec2(0.15, 0.05)));
  col *= mix(0.50, 1.00, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
        depth: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null) ?? null;
    if (!gl) {
      setFailed(true);
      return;
    }

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram();
    if (!vert || !frag || !program) {
      setFailed(true);
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(program);

    // Fullscreen triangle: one vertex past each corner.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");

    let width = 1;
    let height = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (w !== width || h !== height) {
        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        if (reduced) frame(); // keep the static frame crisp on resize
      }
    };

    const start = performance.now();
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || prefersStaticMotion();

    const frame = () => {
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let inView = true;
    let pageVisible = !document.hidden;

    // Background decoration: 30fps is plenty and halves the GPU load.
    let lastDraw = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < 1000 / 30) return;
      lastDraw = now;
      frame();
    };
    const update = () => {
      cancelAnimationFrame(raf);
      if (reduced) {
        frame(); // single static frame, never animated
        return;
      }
      if (inView && pageVisible) raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      update();
    });
    io.observe(canvas);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    update();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  if (failed) {
    return <div className={`shader-fallback ${className ?? ""}`} aria-hidden="true" />;
  }
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
