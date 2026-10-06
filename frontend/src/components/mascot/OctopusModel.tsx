import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type Group, type Mesh, type MeshPhysicalMaterial } from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { getHoverTarget } from "./hoverTarget";
import { useIdleState } from "./useIdleState";
import { useThemeMode } from "./useThemeMode";

// ─── Body and tentacles: one blobby surface ──────────────────────────────────
// Octi is built from metaballs: one big soft ball for the body and a chain of
// shrinking balls for each tentacle. Their fields add up and the surface is
// drawn where the total crosses a threshold, so neighbouring balls melt into
// each other. That gives round tentacles (not flat flaps) that flow out of the
// body with no seam, which separate meshes or a reshaped sphere can't do.
//
// Coordinates here are MarchingCubes' own: a 0..1 box. The mesh is scaled so
// the body comes out at radius 1 in the scene, centred on the origin, which
// is what the eyes and headphones are placed against.

// Grid cells per side. The surface is rebuilt every frame on the CPU, so this
// is the cost knob: 64^3 cells keeps tentacle tips round at this size without
// eating the frame budget.
const RESOLUTION = 64;
const ISO = 80; // MarchingCubes' default isolation level

const BODY = { x: 0.5, y: 0.6, z: 0.5, r: 0.25 };
// Resting height in the scene: the body sits above centre so the tentacles
// hanging below it fit in the frame.
const LIFT = 0.45;
// box units -> scene units, so BODY.r becomes 1
const SCALE = 1 / (2 * BODY.r);

const LEG_COUNT = 6;
const BALLS_PER_LEG = 8;
// Around the front half only (0 = Octi's right, 90 = facing the camera). No
// leg at exactly 90 degrees: one dead centre looked like a fist.
const LEG_ANGLES = [0, 36, 72, 108, 144, 180].map((d) => (d * Math.PI) / 180);

/**
 * A ball whose surface, on its own, sits at radius `r`. `falloff` (the
 * library's "subtract") sets how far its field reaches: higher = tighter, so
 * it blends less with its neighbours.
 */
function addBall(mc: MarchingCubes, x: number, y: number, z: number, r: number, falloff: number) {
  mc.addBall(x, y, z, (ISO + falloff) * r * r, falloff);
}

/**
 * Rebuild the surface for this frame.
 * `swing(leg)` turns a tentacle's tip around the body, `lift(leg)` raises or
 * lowers it, so the legs sway on their own phases.
 */
function sculpt(
  mc: MarchingCubes,
  swing: (leg: number) => number,
  lift: (leg: number) => number,
) {
  mc.reset();
  addBall(mc, BODY.x, BODY.y, BODY.z, BODY.r, 30);

  for (let leg = 0; leg < LEG_COUNT; leg++) {
    for (let j = 0; j < BALLS_PER_LEG; j++) {
      const t = j / (BALLS_PER_LEG - 1);
      // Roots start inside the lower body; each leg then runs down and out,
      // the tip curling outward and slightly up, and swaying more than the
      // root, which is anchored.
      const angle = LEG_ANGLES[leg] + swing(leg) * t * t;
      const out = 0.11 + 0.05 * t + 0.06 * t * t;
      const y = BODY.y - 0.17 - (0.25 + lift(leg)) * t + 0.06 * t * t * t;
      // Thick at the root, tapering to a round tip. Scaled down because
      // overlapping balls add up and fatten the tube.
      const radius = (0.068 - 0.03 * t) * 0.72;
      addBall(mc, BODY.x + Math.cos(angle) * out, y, BODY.z + Math.sin(angle) * out, radius, 40);
    }
  }

  mc.update();
}

/**
 * What Octi is doing, from the brand sheet's "Expressions & states".
 *   idle     - round glossy eyes, blinking and looking about
 *   happy    - ^ ^ eyes (on hover)
 *   focus    - headphones on, eyes closed contentedly (a timer is running)
 *   sleeping - eyes closed, head drooped, barely moving (late at night)
 */
export type Mood = "idle" | "happy" | "focus" | "sleeping";

const EYE_SEGMENTS: [number, number] = [32, 24];

// Body colour per theme, from the brand palette: #F8FAFF white with #DCE6FF
// lavender in the shading. Octi is the same white in both themes; light mode
// just takes less from the environment so it doesn't blow out against a pale
// page, and leans on the blue rim (see Lighting) to hold its edge.
const SKIN = {
  dark: { body: "#f8faff", env: 0.85 },
  light: { body: "#f4f7ff", env: 0.6 },
};

function damp(current: number, target: number, t: number, delta: number) {
  return current + (target - current) * (1 - Math.pow(1 - t, delta * 60));
}

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

/** Hermite ease — 0 at the edges, 1 in the middle, zero slope at both ends. */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export default function OctopusModel({ mood = "idle" }: { mood?: Mood }) {
  // Calm moods hold still: no hopping, bobbing or looking about.
  const calm = mood === "focus" || mood === "sleeping";
  const sleeping = mood === "sleeping";

  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);

  // Materials are recoloured by lerping in useFrame rather than by swapping
  // the prop, so the theme switch eases across instead of popping.
  const bodyMat = useRef<MeshPhysicalMaterial>(null);

  // The surface is rebuilt every frame (that is how the tentacles move), so
  // it is created once here and handed to R3F as a primitive. It starts with
  // no material; the JSX below attaches one.
  const blob = useMemo(() => {
    const mc = new MarchingCubes(RESOLUTION, undefined as never, false, false, 60000);
    mc.isolation = ISO;
    // Its bounding sphere never tracks the changing surface; don't let the
    // camera cull it on a stale one.
    mc.frustumCulled = false;
    return mc;
  }, []);
  useEffect(() => () => blob.geometry.dispose(), [blob]);

  const idle = useIdleState();
  const { gl } = useThree();
  const mode = useThemeMode();

  // Re-created only when the theme changes, not every frame.
  const target = useMemo(
    () => ({
      body: new Color(SKIN[mode].body),
      env: SKIN[mode].env,
    }),
    [mode],
  );

  const look = useRef({ x: 0, y: 0 });
  const blink = useRef(1);
  const saccade = useRef({ x: 0, y: 0, next: 0 });
  const lastBodyY = useRef(LIFT);
  const armLag = useRef(0);
  const clock = useRef(0);

  useFrame((_, rawDelta) => {
    // A backgrounded tab hands back a huge delta on return; clamping stops the
    // mascot teleporting through half an animation.
    const delta = Math.min(rawDelta, 0.05);
    clock.current += delta;
    idle.advance(delta);

    const state = calm ? "legSway" : idle.state.current;
    const t = idle.elapsed.current;
    const hold = idle.holdFor.current;

    // ── Colour ──────────────────────────────────────────────────────────────
    const blend = 1 - Math.pow(1 - 0.06, delta * 60);
    if (bodyMat.current) {
      bodyMat.current.color.lerp(target.body, blend);
      bodyMat.current.envMapIntensity = damp(
        bodyMat.current.envMapIntensity,
        target.env,
        0.06,
        delta,
      );
    }

    // ── State envelope ──────────────────────────────────────────────────────
    // Each behaviour fades in and out, so switching never snaps.
    const envelope =
      smoothstep(0, 0.55, t) * smoothstep(0, 0.55, Math.max(0, hold - t));

    // ── Look direction ──────────────────────────────────────────────────────
    // Hover is an override layer, not a fifth state.
    const hover = getHoverTarget();
    let targetX = 0;
    let targetY = 0;

    if (hover && !calm) {
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = clamp((hover.x - cx) / (window.innerWidth * 0.4), -1, 1);
      targetY = clamp((hover.y - cy) / (window.innerHeight * 0.4), -1, 1);
    } else if (!calm && state === "blinkLook") {
      const sweep = Math.sin(t * 0.85);
      targetX = Math.sign(sweep) * Math.pow(Math.abs(sweep), 0.6) * 0.85 * envelope;
      targetY = Math.sin(t * 0.6) * 0.18 * envelope;
    }

    // Micro-saccades: real eyes never hold perfectly still.
    if (clock.current > saccade.current.next) {
      saccade.current.x = (Math.random() - 0.5) * 0.12;
      saccade.current.y = (Math.random() - 0.5) * 0.08;
      saccade.current.next = clock.current + 0.7 + Math.random() * 1.8;
    }

    look.current.x = damp(look.current.x, targetX + saccade.current.x, 0.14, delta);
    look.current.y = damp(look.current.y, targetY + saccade.current.y, 0.14, delta);

    if (eyes.current) {
      eyes.current.position.x = look.current.x * 0.055;
      eyes.current.position.y = -look.current.y * 0.042;
    }

    // ── Blink ───────────────────────────────────────────────────────────────
    // On the global clock, NOT the per-state `t`: `t` resets on every state
    // change and the blink window sits at the start of the cycle, so keying
    // off it made the mascot blink on every transition.
    const period = state === "blinkLook" ? 2.1 : 4.8;
    const phase = clock.current % period;
    const shut = phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;
    blink.current = 1 - shut * 0.92;

    for (const eye of [leftEye.current, rightEye.current]) {
      if (eye) {
        eye.scale.y = 1.3 * blink.current;
        eye.position.y = -shut * 0.03;
      }
    }

    // ── Body ────────────────────────────────────────────────────────────────
    // Breathing is always on, under whatever the state is doing.
    const breathe = Math.sin(clock.current * (sleeping ? 0.7 : 1.15)) * (sleeping ? 0.02 : 0.012);

    let bobY = 0;
    let nodX = 0;
    let hopY = 0;
    let squash = 1;

    if (state === "headBob") {
      bobY = Math.sin(t * 1.7) * 0.06 * envelope;
      nodX = Math.sin(t * 1.7 - 0.55) * 0.08 * envelope;
    }

    if (state === "hop") {
      const cycle = (t % 1.25) / 1.25;
      if (cycle < 0.2) {
        squash = 1 - 0.18 * Math.sin((cycle / 0.2) * Math.PI) * envelope;
      } else if (cycle < 0.66) {
        const k = (cycle - 0.2) / 0.46;
        hopY = Math.sin(k * Math.PI) * 0.44 * envelope;
        squash = 1 + 0.16 * Math.abs(Math.cos(k * Math.PI)) * envelope;
      } else if (cycle < 0.84) {
        const k = (cycle - 0.66) / 0.18;
        squash = 1 - 0.22 * Math.sin(k * Math.PI) * envelope;
      }
    }

    if (root.current) {
      root.current.position.y = damp(root.current.position.y, LIFT + hopY, 0.4, delta);
      root.current.scale.y = damp(root.current.scale.y, squash + breathe, 0.35, delta);
      const width = 1 / Math.sqrt(Math.max(0.5, squash + breathe));
      root.current.scale.x = damp(root.current.scale.x, width, 0.35, delta);
      root.current.scale.z = damp(root.current.scale.z, width, 0.35, delta);
    }

    if (body.current) {
      body.current.position.y = damp(body.current.position.y, bobY, 0.16, delta);
      body.current.rotation.x = damp(body.current.rotation.x, nodX, 0.16, delta);
      body.current.rotation.y = damp(body.current.rotation.y, look.current.x * 0.3, 0.1, delta);
      // Asleep, the head lolls to one side, like the sheet's sleeping pose.
      const loll = sleeping ? 0.16 : -look.current.x * 0.06;
      body.current.rotation.z = damp(body.current.rotation.z, loll, 0.04, delta);
    }

    // ── Legs ────────────────────────────────────────────────────────────────
    // Follow-through: legs lag behind vertical body movement, so a hop trails
    // them (longer on the way up, tucked on landing) rather than moving the
    // whole shape as one rigid piece.
    const bodyY = root.current?.position.y ?? 0;
    const velocity = (bodyY - lastBodyY.current) / Math.max(delta, 0.001);
    lastBodyY.current = bodyY;
    armLag.current = damp(armLag.current, clamp(velocity * 0.05, -0.6, 0.6), 0.18, delta);

    // Sway: each leg stretches and relaxes on its own phase, so they never
    // move in lockstep. Never zero — a perfectly rigid leg stops looking soft.
    const sway = calm ? 0.04 : state === "legSway" ? 0.14 * envelope + 0.06 : 0.06;
    const time = clock.current;
    const lag = armLag.current;
    sculpt(
      blob,
      (leg) => Math.sin(time * 1.5 + leg * 1.3) * sway * 3,
      (leg) => Math.sin(time * 1.9 + leg * 1.05) * sway * 0.25 + lag * 0.04,
    );
  });

  return (
    <group ref={root} position={[0, LIFT, 0]}>
      <group ref={body}>
        {/* Taller than wide: Octi stands as a slight upright egg. Offset so
            the body's centre, not the box's, sits at the origin. */}
        <primitive
          object={blob}
          castShadow
          receiveShadow
          scale={[SCALE * 1.06, SCALE * 1.14, SCALE]}
          position={[0, -SCALE * 1.14 * (2 * BODY.y - 1), 0]}
        >
          {/* Physical, not standard: clearcoat gives injection-moulded toys
              their faint waxy sheen over a matte base. */}
          <meshPhysicalMaterial
            ref={bodyMat}
            roughness={0.62}
            metalness={0}
            clearcoat={0.45}
            clearcoatRoughness={0.55}
            envMapIntensity={0.85}
            sheen={0.35}
            sheenColor="#ffffff"
            sheenRoughness={0.8}
            attach="material"
          />
        </primitive>

        <group ref={eyes}>
          {/* Hidden rather than unmounted, so the refs and blink keep working
              when the expression switches back. */}
          <group visible={mood === "idle"}>
            <Eye ref={leftEye} x={-0.34} />
            <Eye ref={rightEye} x={0.34} />
          </group>
          {mood !== "idle" && (
            <>
              <ArcEye x={-0.34} up={mood === "happy"} />
              <ArcEye x={0.34} up={mood === "happy"} />
            </>
          )}
        </group>

        {mood === "focus" && <Headphones />}
      </group>

    </group>
  );
}

/** One eye: a glossy dark oval sitting proud of the face curve, with a bright
 *  catchlight and a dimmer secondary — a single highlight looks like a decal.
 *
 *  The z offset matters: at this x the sphere's surface is around z=0.95, so
 *  an eye centred nearer the middle ends up buried inside the head. */
const Eye = ({ ref, x }: { ref: React.Ref<Mesh>; x: number }) => (
  <group position={[x, 0.04, 0.935]}>
    {/* Flattened in z so the whole oval clears the head's curve; deeper,
        the top and bottom sank into the face and left a thin slit. */}
    <mesh ref={ref} scale={[0.8, 1.3, 0.45]}>
      <sphereGeometry args={[0.17, ...EYE_SEGMENTS]} />
      <meshPhysicalMaterial
        color="#08080a"
        roughness={0.06}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.04}
        envMapIntensity={1.4}
      />
    </mesh>

    <mesh position={[0.04, 0.09, 0.08]}>
      <sphereGeometry args={[0.032, 16, 12]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
    <mesh position={[-0.035, -0.06, 0.075]}>
      <sphereGeometry args={[0.014, 12, 10]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} opacity={0.55} transparent />
    </mesh>
  </group>
);

/** A closed eye drawn as a curve: ^ when `up` (happy), a soft upturned
 *  smile shape otherwise (focused, asleep). Half a torus, flipped for that. */
const ArcEye = ({ x, up }: { x: number; up: boolean }) => (
  <mesh position={[x, up ? 0 : 0.06, 0.965]} rotation={[0, 0, up ? 0 : Math.PI]}>
    <torusGeometry args={[0.1, 0.026, 10, 28, Math.PI]} />
    <meshPhysicalMaterial color="#08080a" roughness={0.2} clearcoat={1} />
  </mesh>
);

/** Focus mode's headphones: a band over the crown and a cup on each side, in
 *  the sheet's blue. Sized to the body sphere (radius 1, x-scale 1.06). */
function Headphones() {
  // Stretched to match the body's height, so the band sits on the crown.
  return (
    <group rotation={[-0.12, 0, 0]} scale={[1, 1.14, 1]}>
      <mesh>
        <torusGeometry args={[1.08, 0.075, 14, 48, Math.PI]} />
        <meshPhysicalMaterial color="#2f5bff" roughness={0.35} clearcoat={1} clearcoatRoughness={0.2} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.08, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />
            <meshPhysicalMaterial color="#2f5bff" roughness={0.35} clearcoat={1} clearcoatRoughness={0.2} />
          </mesh>
          {/* The glowing ring on the outer face. */}
          <mesh position={[0, -side * 0.105, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 32]} />
            <meshBasicMaterial color="#00d1ff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
