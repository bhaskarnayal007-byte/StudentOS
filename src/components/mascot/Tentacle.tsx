import type { Group, Material } from "three";

export const SEGMENTS = 5;
const SEG_LENGTH = 0.2;
const BASE_RADIUS = 0.2;
const TIP_RADIUS = 0.085;

/** Radius at segment `i`. The exponent keeps the taper gentle near the body
 *  and quicker at the tip — a linear taper reads as a cone, and taking it too
 *  thin (0.045) made the arms look like spindly wires rather than limbs. */
export function radiusAt(i: number) {
  const t = i / (SEGMENTS - 1);
  return BASE_RADIUS + (TIP_RADIUS - BASE_RADIUS) * Math.pow(t, 1.5);
}

type Props = {
  index: number;
  register: (segment: number, group: Group | null) => void;
  material: Material;
};

/**
 * One link in a tentacle, rendering its own child recursively.
 *
 * Each segment is a group hinged at the *end of the previous one*, so
 * rotating segment N also carries every segment after it. Small per-segment
 * angles therefore accumulate into a smooth continuous curl — which is what a
 * chain of independent capsules could never do, and why the previous
 * two-capsule arm always looked like a hinged stick.
 */
export default function Tentacle({ index, register, material }: Props) {
  const radius = radiusAt(index);

  return (
    <group
      ref={(el) => { register(index, el); }}
      // Hinge at the tip of the parent segment. Segment 0 is positioned by
      // the body, so it sits at the origin of its own group.
      position={index === 0 ? [0, 0, 0] : [0, -SEG_LENGTH, 0]}
    >
      <mesh
        // Deliberately NOT a shadow caster or receiver. These sit directly
        // under the body, so they land inside its shadow, and thin geometry
        // self-shadows badly against a shadow map — together that rendered
        // them near-black. The ContactShadows below still ground them.
        position={[0, -SEG_LENGTH / 2, 0]}
        material={material}
      >
        {/* Low radial counts: these are thin and small on screen, and there
            are SEGMENTS x 6 of them. */}
        <capsuleGeometry args={[radius, SEG_LENGTH, 3, 12]} />
      </mesh>

      {index + 1 < SEGMENTS && (
        <Tentacle index={index + 1} register={register} material={material} />
      )}
    </group>
  );
}
