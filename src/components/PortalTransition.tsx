import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
// A one-shot canvas overlay: the login form fragments into particles, they
// swirl inward into a glowing accent ring, the ring holds, then the whole
// canvas fades out to reveal the app underneath.
//
// Plain Canvas 2D and one rAF loop — a particle library would be a permanent
// dependency for an effect that runs once, for two seconds, ever.
// ─────────────────────────────────────────────────────────────────────────────

/** Screen-space boxes to sample particles from (the form's elements). */
export type SeedRect = { x: number; y: number; width: number; height: number };

type Props = {
  seeds?: SeedRect[];
  onComplete: () => void;
};

const DURATION = 2100; // ms — inside the 1.5–2.5s brief
const PARTICLES = 900;

// Phase boundaries as a fraction of DURATION.
const SCATTER_END = 0.26;
const CONVERGE_END = 0.72;
const HOLD_END = 0.88;

type Particle = {
  r0: number;
  theta0: number;
  ringTheta: number;
  size: number;
  color: string;
  /** Per-particle timing offset so they don't move as one rigid body. */
  delay: number;
  scatter: number;
  twinkle: number;
};

export default function PortalTransition({ seeds, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held in a ref so the effect below never re-runs and restarts the animation
  // if the parent happens to re-render mid-flight.
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) {
      onComplete();
      return;
    }
    // Aliased after the null check: TypeScript doesn't carry the narrowing
    // into the hoisted `frame` function below, and `ctx!` on every line is
    // noise that also silences a real null if this is ever refactored.
    const ctx: CanvasRenderingContext2D = maybeCtx;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete();
    };

    // Anyone who asked for reduced motion gets the destination, not the ride.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(finish, 220);
      return () => clearTimeout(t);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const cx = width / 2;
    const cy = height / 2;

    // Read the theme's own colours rather than hardcoding, so the effect looks
    // native in both light and dark.
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    const accent = token("--color-accent", "#2E5334");
    const text = token("--color-text", "#1C1B19");
    const base = token("--color-base", "#F3F0EA");

    const ringRadius = Math.min(width, height) * 0.17;
    const particles = buildParticles(seeds, width, height, cx, cy, [text, accent]);

    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      const elapsed = now - start;
      const p = Math.min(elapsed / DURATION, 1);

      // Wipe with the page's own base colour so the login screen is hidden
      // behind the effect rather than showing through it.
      const veil = p < SCATTER_END ? easeOut(p / SCATTER_END) : 1;
      const fade = p > HOLD_END ? 1 - (p - HOLD_END) / (1 - HOLD_END) : 1;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = veil * fade;
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      // Converge progress, 0 until the scatter phase ends.
      const convergeRaw = (p - SCATTER_END) / (CONVERGE_END - SCATTER_END);

      for (const particle of particles) {
        // Stagger: each particle's own converge clock, clamped to 0..1.
        const c = clamp01((convergeRaw - particle.delay) / (1 - particle.delay));
        const eased = easeInOut(c);

        // Radius travels from where the particle was born, out a little during
        // the scatter, then in to the ring.
        const scattered = particle.r0 * (1 + particle.scatter * (1 - eased));
        const radius = scattered + (ringRadius - scattered) * eased;

        // Swirl: the angle winds as the radius collapses, which is what makes
        // it read as a vortex rather than a straight implosion.
        const theta =
          particle.theta0 +
          eased * 2.4 +
          (particle.ringTheta - particle.theta0) * eased * eased;

        const x = cx + Math.cos(theta) * radius;
        const y = cy + Math.sin(theta) * radius;

        // Particles take on the accent as they join the ring.
        ctx.globalAlpha = fade * (0.35 + 0.65 * eased) * particle.twinkle;
        ctx.fillStyle = eased > 0.55 ? accent : particle.color;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * (1 - 0.35 * eased), 0, Math.PI * 2);
        ctx.fill();
      }

      // The portal itself: a glowing ring that builds as particles arrive.
      const ringT = clamp01((p - 0.42) / 0.3);
      if (ringT > 0) {
        drawRing(ctx, cx, cy, ringRadius, accent, ringT * fade, p);
      }

      if (p >= 1) return finish();
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    // Safety net: browsers pause requestAnimationFrame in a backgrounded or
    // hidden tab. Without this, submitting and immediately switching tabs
    // leaves the overlay mounted indefinitely, because the loop that would
    // have called onComplete never runs another frame.
    const failsafe = setTimeout(finish, DURATION + 700);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      window.removeEventListener("resize", resize);
    };
    // Intentionally empty: this animation runs exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <canvas ref={canvasRef} className="portal-canvas" aria-hidden="true" />,
    document.body,
  );
}

/** Particles start inside the form's boxes when we have them, and across the
 *  middle of the screen when we don't. */
function buildParticles(
  seeds: SeedRect[] | undefined,
  width: number,
  height: number,
  cx: number,
  cy: number,
  palette: string[],
): Particle[] {
  const boxes =
    seeds && seeds.length
      ? seeds
      : [{ x: width * 0.3, y: height * 0.35, width: width * 0.4, height: height * 0.3 }];

  // Weight by area so a big box doesn't get the same particle count as a small
  // one — otherwise the button looks denser than the whole card.
  const totalArea = boxes.reduce((sum, b) => sum + b.width * b.height, 0) || 1;

  const out: Particle[] = [];
  for (const box of boxes) {
    const count = Math.max(12, Math.round((box.width * box.height / totalArea) * PARTICLES));
    for (let i = 0; i < count; i++) {
      const x = box.x + Math.random() * box.width;
      const y = box.y + Math.random() * box.height;
      const dx = x - cx;
      const dy = y - cy;
      out.push({
        r0: Math.hypot(dx, dy),
        theta0: Math.atan2(dy, dx),
        ringTheta: Math.random() * Math.PI * 2,
        size: 0.7 + Math.random() * 1.6,
        color: palette[Math.random() < 0.82 ? 0 : 1],
        delay: Math.random() * 0.35,
        scatter: 0.06 + Math.random() * 0.22,
        twinkle: 0.55 + Math.random() * 0.45,
      });
    }
  }
  return out;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  accent: string,
  strength: number,
  p: number,
) {
  // Slow pulse so the held portal isn't static.
  const pulse = 1 + Math.sin(p * 22) * 0.02;
  const r = radius * pulse;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.5);
  glow.addColorStop(0, "transparent");
  glow.addColorStop(0.55, accent);
  glow.addColorStop(1, "transparent");

  ctx.globalAlpha = 0.32 * strength;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.9 * strength;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = strength;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
