import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Shader extracted from MengTo/threeui (MIT) — src/shaders/neuform-isolated/NeuformBatchEffects.tsx,
 * export `TopoField`. Upstream renders it inside a template landing page in an iframe; here only
 * the WebGL effect is kept, drawn straight onto a canvas this component owns.
 */

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpr;
uniform float u_noiseScale;
uniform float u_bands;
uniform float u_grid;
uniform float u_line;
uniform vec3 u_paper;
uniform vec3 u_ink;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // 1px physical grid every 48 CSS px.
    float gridSize = 48.0 * u_dpr;
    vec2 gridFract = fract(gl_FragCoord.xy / gridSize);
    float lineThickness = 1.0 / gridSize;
    float gridLines = step(1.0 - lineThickness, gridFract.x) + step(1.0 - lineThickness, gridFract.y);
    gridLines = clamp(gridLines, 0.0, 1.0) * u_grid;

    // Contour lines: the edges of bands cut through drifting simplex noise.
    vec2 noisePos = st * u_noiseScale + vec2(u_time * 0.015, u_time * 0.025);
    float n = snoise(noisePos) * 0.5 + 0.5;
    float triangleWave = abs(fract(n * u_bands) - 0.5) * 2.0;
    float topoLines = smoothstep(0.03, 0.00, triangleWave) * u_line;

    // Mixing paper toward ink covers any palette; upstream's additive
    // white-on-black is the same thing with a black paper.
    gl_FragColor = vec4(mix(u_paper, u_ink, clamp(gridLines + topoLines, 0.0, 1.0)), 1.0);
}
`;

type TopoFieldMode = "dark" | "light";

export type TopoFieldProps = {
  /** "auto" follows the page's light/dark scheme via prefers-color-scheme. */
  mode?: TopoFieldMode | "auto";
  /** Animation speed multiplier. */
  speed?: number;
  /** Stretches/compresses the noise field driving the contour bands. */
  length?: number;
  /** Multiplies the number of contour bands (visual density of lines). */
  density?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  /** Background colour (hex). Defaults to black in dark mode, paper in light. */
  paper?: string;
  /** Grid + contour line colour (hex). Defaults to white in dark, ink in light. */
  ink?: string;
  /** 0-1 strength of the 48px grid. */
  gridStrength?: number;
  /** 0-1 strength of the topographic contour lines. */
  lineStrength?: number;
  className?: string;
  style?: CSSProperties;
};

/** Per-mode defaults, chosen so omitting paper/ink reproduces the original look. */
const MODE_DEFAULTS = {
  dark: { paper: "#000000", ink: "#ffffff", gridStrength: 0.12, lineStrength: 0.45 },
  light: { paper: "#eef1f6", ink: "#1f2330", gridStrength: 0.55, lineStrength: 0.95 },
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** "#2B2E27" → [0.169, 0.180, 0.153]; anything unparseable is black. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.replace(/./g, "$&$&") : clean;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function readAutomaticMode(): TopoFieldMode {
  if (typeof document === "undefined" || typeof window === "undefined")
    return "dark";
  const root = document.documentElement;
  const declared = root.dataset.scheme;
  if (declared === "light" || declared === "dark") return declared;
  // Themes declare their color-scheme in CSS, so any data-theme id resolves.
  return getComputedStyle(root).colorScheme.trim() === "dark" ? "dark" : "light";
}

function useAutomaticMode(enabled: boolean) {
  const [autoMode, setAutoMode] = useState<TopoFieldMode>(readAutomaticMode);

  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setAutoMode(readAutomaticMode());
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-scheme", "data-theme"],
    });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);

  return autoMode;
}

type Knobs = {
  speed: number;
  noiseScale: number;
  bands: number;
  grid: number;
  line: number;
  paper: [number, number, number];
  ink: [number, number, number];
};

/**
 * TopoField — a full-bleed animated WebGL background: a faint 48px grid plus ultra-thin contour
 * ("topographic") lines drawn from 2D simplex noise, drifting slowly over time.
 */
export default function TopoField({
  mode = "dark",
  speed = 1,
  length = 1,
  density = 1,
  opacity = 1,
  hue = 0,
  saturation = 1,
  brightness = 1,
  paper,
  ink,
  gridStrength,
  lineStrength,
  className,
  style,
}: TopoFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const automaticMode = useAutomaticMode(mode === "auto");
  const resolvedMode: TopoFieldMode =
    mode === "auto" ? automaticMode : mode === "light" ? "light" : "dark";

  // Explicit colours win; otherwise fall back to the mode's original look.
  const defaults = MODE_DEFAULTS[resolvedMode];
  const paperColor = paper ?? defaults.paper;
  const inkColor = ink ?? defaults.ink;

  // The render loop reads knobs from a ref each frame, so prop changes apply
  // live without tearing down the GL context.
  const knobs = useRef<Knobs>(null!);
  knobs.current = {
    speed: clamp(speed, 0, 3),
    noiseScale: 1.4 * clamp(length, 0.35, 2.5),
    bands: 10 * clamp(density, 0.25, 2.5),
    grid: clamp(gridStrength ?? defaults.gridStrength, 0, 1),
    line: clamp(lineStrength ?? defaults.lineStrength, 0, 1),
    paper: hexToRgb(paperColor),
    ink: hexToRgb(inkColor),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!canvas || !gl) return undefined;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      resolution: at("u_resolution"),
      time: at("u_time"),
      dpr: at("u_dpr"),
      noiseScale: at("u_noiseScale"),
      bands: at("u_bands"),
      grid: at("u_grid"),
      line: at("u_line"),
      paper: at("u_paper"),
      ink: at("u_ink"),
    };

    // Phones: a full-resolution shader redrawn 60 times a second behind
    // the page made scrolling flicker. Soft lines look the same at 1x
    // and 30fps, at a fraction of the work.
    const phone = window.innerWidth <= 620;
    const frameMs = phone ? 1000 / 30 : 0;

    // Shader time advances by speed-scaled real time, so a speed change
    // slows the drift rather than jumping the field.
    let shaderTime = 0;
    let lastTick = performance.now();
    let lastDraw = 0;
    let frame = 0;

    const draw = (now: number) => {
      const k = knobs.current;
      shaderTime += ((now - lastTick) / 1000) * k.speed;
      lastTick = now;
      gl.uniform1f(u.time, shaderTime);
      gl.uniform1f(u.noiseScale, k.noiseScale);
      gl.uniform1f(u.bands, k.bands);
      gl.uniform1f(u.grid, k.grid);
      gl.uniform1f(u.line, k.line);
      gl.uniform3fv(u.paper, k.paper);
      gl.uniform3fv(u.ink, k.ink);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const resize = () => {
      const dpr = phone ? 1 : window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      // Setting the size clears the canvas, so only do it on a real change.
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.resolution, w, h);
      gl.uniform1f(u.dpr, dpr);
      // Repaint now rather than leave it blank until the next frame.
      draw(performance.now());
    };

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (now - lastDraw < frameMs) return;
      lastDraw = now;
      draw(now);
    };

    window.addEventListener("resize", resize);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      // No loseContext(): StrictMode remounts onto the same canvas, and a lost
      // context can't be fetched again. The context dies with the element.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      // Force the next mount's resize() to reconfigure its fresh program.
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  const safeHue = clamp(hue, -180, 180);
  const safeSaturation = clamp(saturation, 0, 2);
  const safeBrightness = clamp(brightness, 0.35, 1.65);
  const filter =
    safeHue === 0 && safeSaturation === 1 && safeBrightness === 1
      ? undefined
      : `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        // Shows before the first frame and if WebGL is unavailable.
        background: paperColor,
        opacity: clamp(opacity, 0.05, 1),
        filter,
        ...style,
      }}
    />
  );
}
