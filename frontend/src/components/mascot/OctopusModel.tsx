import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, MeshPhysicalMaterial, type Group, type Mesh } from "three";
import { getHoverTarget } from "./hoverTarget";
import { useIdleState } from "./useIdleState";
import { useThemeMode } from "./useThemeMode";
import Tentacle, { SEGMENTS } from "./Tentacle";

const ARM_COUNT = 6;

// Dense enough that the silhouette and the specular roll-off stay smooth.
// One object on screen — a 64x48 sphere is ~6k triangles, which is nothing.
const BODY_SEGMENTS: [number, number] = [64, 48];
const EYE_SEGMENTS: [number, number] = [32, 24];

// Body colour per theme. Dark keeps the reference's matte white; light turns
// warm orange. Arms are a touch deeper so they read against the body.
//
// `env` matters as much as the colour: a bright studio environment reflecting
// off a saturated surface washes it toward white, and ACES tone mapping
// desaturates the highlights further. A mid-orange came out looking like warm
// grey. So light mode uses a deeper hue AND takes less from the environment.
const SKIN = {
  dark: { body: "#f2f2f0", arm: "#eaeae8", env: 0.85 },
  light: { body: "#ff5f0f", arm: "#ea4f08", env: 0.34 },
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

export default function OctopusModel() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  // [tentacle][segment] — every joint in every arm.
  const joints = useRef<(Group | null)[][]>(
    Array.from({ length: ARM_COUNT }, () => []),
  );
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);

  // Materials are recoloured by lerping in useFrame rather than by swapping
  // the prop, so the theme switch eases across instead of popping.
  const bodyMat = useRef<MeshPhysicalMaterial>(null);

  // ONE material shared by all 36 tentacle segments. Built by hand rather than
  // in JSX so there is a single object to recolour — and so the GPU isn't
  // asked to switch material state 36 times per frame.
  const armMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        roughness: 0.65,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.8,
      }),
    [],
  );

  // R3F only auto-disposes materials it created from JSX; this one is ours.
  useEffect(() => () => armMaterial.dispose(), [armMaterial]);

  const idle = useIdleState();
  const { gl } = useThree();
  const mode = useThemeMode();

  // Re-created only when the theme changes, not every frame.
  const target = useMemo(
    () => ({
      body: new Color(SKIN[mode].body),
      arm: new Color(SKIN[mode].arm),
      env: SKIN[mode].env,
    }),
    [mode],
  );

  const look = useRef({ x: 0, y: 0 });
  const blink = useRef(1);
  const saccade = useRef({ x: 0, y: 0, next: 0 });
  const lastBodyY = useRef(0);
  const armLag = useRef(0);
  const clock = useRef(0);

  useFrame((_, rawDelta) => {
    // A backgrounded tab hands back a huge delta on return; clamping stops the
    // mascot teleporting through half an animation.
    const delta = Math.min(rawDelta, 0.05);
    clock.current += delta;
    idle.advance(delta);

    const state = idle.state.current;
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
    armMaterial.color.lerp(target.arm, blend);
    armMaterial.envMapIntensity = damp(
      armMaterial.envMapIntensity,
      target.env,
      0.06,
      delta,
    );

    // ── State envelope ──────────────────────────────────────────────────────
    // Each behaviour fades in and out, so switching never snaps.
    const envelope =
      smoothstep(0, 0.55, t) * smoothstep(0, 0.55, Math.max(0, hold - t));

    // ── Look direction ──────────────────────────────────────────────────────
    // Hover is an override layer, not a fifth state.
    const hover = getHoverTarget();
    let targetX = 0;
    let targetY = 0;

    if (hover) {
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = clamp((hover.x - cx) / (window.innerWidth * 0.4), -1, 1);
      targetY = clamp((hover.y - cy) / (window.innerHeight * 0.4), -1, 1);
    } else if (state === "blinkLook") {
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
    const breathe = Math.sin(clock.current * 1.15) * 0.012;

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
      root.current.position.y = damp(root.current.position.y, hopY, 0.4, delta);
      root.current.scale.y = damp(root.current.scale.y, squash + breathe, 0.35, delta);
      const width = 1 / Math.sqrt(Math.max(0.5, squash + breathe));
      root.current.scale.x = damp(root.current.scale.x, width, 0.35, delta);
      root.current.scale.z = damp(root.current.scale.z, width, 0.35, delta);
    }

    if (body.current) {
      body.current.position.y = damp(body.current.position.y, bobY, 0.16, delta);
      body.current.rotation.x = damp(body.current.rotation.x, nodX, 0.16, delta);
      body.current.rotation.y = damp(body.current.rotation.y, look.current.x * 0.3, 0.1, delta);
      body.current.rotation.z = damp(body.current.rotation.z, -look.current.x * 0.06, 0.08, delta);
    }

    // ── Arms ────────────────────────────────────────────────────────────────
    // Follow-through: arms lag behind vertical body movement, so a hop trails
    // them rather than moving the whole shape as one rigid piece.
    const bodyY = root.current?.position.y ?? 0;
    const velocity = (bodyY - lastBodyY.current) / Math.max(delta, 0.001);
    lastBodyY.current = bodyY;
    armLag.current = damp(armLag.current, clamp(velocity * 0.05, -0.6, 0.6), 0.18, delta);

    // Sway strength: lifted during legSway, but never zero — a tentacle that
    // holds perfectly rigid stops looking like soft tissue.
    const sway = state === "legSway" ? 0.16 * envelope + 0.05 : 0.05;

    joints.current.forEach((chain, i) => {
      // Each arm runs the same wave at its own offset, so they never move in
      // lockstep.
      const armPhase = i * 1.05;

      chain.forEach((joint, j) => {
        if (!joint) return;
        const along = j / (SEGMENTS - 1);

        // The wave travels DOWN the arm: each segment lags the one above it,
        // which is what produces a curl that ripples outward to the tip
        // instead of the whole limb swinging as one piece.
        const wavePhase = clock.current * 1.9 + armPhase - j * 0.55;

        // Amplitude grows toward the tip — the base is anchored in the body
        // and the end is free, so the end moves most.
        const reach = 0.25 + along * 1.5;

        // A permanent curl that builds toward the tip. Kept small because it
        // ACCUMULATES down the chain — every segment inherits its parent's
        // angle, so 0.34 per joint compounded to roughly 77 degrees and tucked
        // the arms up underneath the body.
        const droop = 0.03 + along * 0.15;

        const targetX =
          Math.sin(wavePhase) * sway * reach + droop - armLag.current * (0.35 + along);
        const targetZ = Math.cos(wavePhase * 0.8) * sway * reach * 0.6;

        joint.rotation.x = damp(joint.rotation.x, targetX, 0.13, delta);
        joint.rotation.z = damp(joint.rotation.z, targetZ, 0.13, delta);
      });
    });
  });

  return (
    <group ref={root} position={[0, -0.05, 0]}>
      <group ref={body}>
        <mesh castShadow receiveShadow scale={[1.05, 0.98, 1]}>
          <sphereGeometry args={[1, ...BODY_SEGMENTS]} />
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
          />
        </mesh>

        <group ref={eyes}>
          <Eye ref={leftEye} x={-0.325} />
          <Eye ref={rightEye} x={0.325} />
        </group>
      </group>

      {/* Tentacles: a chain of tapering segments per arm, each hinged at the
          end of the one above. Rooted up inside the body so they read as
          growing out of it rather than floating beneath. */}
      {Array.from({ length: ARM_COUNT }, (_, i) => {
        const angle = (i / ARM_COUNT) * Math.PI * 2 + Math.PI / ARM_COUNT;
        const spread = 0.74;

        return (
          <group
            key={i}
            position={[Math.cos(angle) * spread, -0.5, Math.sin(angle) * spread]}
            // Splayed outward from centre. This is the arm's root orientation;
            // the per-segment animation adds to it from here.
            rotation={[Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5]}
          >
            <Tentacle
              index={0}
              material={armMaterial}
              register={(segment, group) => {
                joints.current[i][segment] = group;
              }}
            />
          </group>
        );
      })}
    </group>
  );
}

/** One eye: a glossy dark oval sitting proud of the face curve, with a bright
 *  catchlight and a dimmer secondary — a single highlight looks like a decal.
 *
 *  The z offset matters: at this x the sphere's surface is around z=0.95, so
 *  an eye centred nearer the middle ends up buried inside the head. */
const Eye = ({ ref, x }: { ref: React.Ref<Mesh>; x: number }) => (
  <group position={[x, 0.05, 0.9]}>
    <mesh ref={ref} scale={[0.82, 1.3, 0.62]}>
      <sphereGeometry args={[0.15, ...EYE_SEGMENTS]} />
      <meshPhysicalMaterial
        color="#08080a"
        roughness={0.06}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.04}
        envMapIntensity={1.4}
      />
    </mesh>

    <mesh position={[0.042, 0.075, 0.075]}>
      <sphereGeometry args={[0.032, 16, 12]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
    <mesh position={[-0.035, -0.05, 0.07]}>
      <sphereGeometry args={[0.014, 12, 10]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} opacity={0.55} transparent />
    </mesh>
  </group>
);
