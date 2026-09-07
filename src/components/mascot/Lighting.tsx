import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/**
 * A studio rig built from lightformers rather than point lights.
 *
 * This is what makes matte white read as a real object: a bare directional
 * light gives one flat falloff, whereas an environment gives the surface
 * something to actually reflect, so the body picks up a soft gradient and the
 * glossy eyes get a shaped catchlight instead of a painted-on dot.
 *
 * The environment is generated in-scene — deliberately NOT drei's
 * `preset="studio"`, which downloads an HDR from a CDN at runtime. That would
 * be a network dependency inside an offline-first PWA.
 */
export default function Lighting() {
  return (
    <>
      {/* Kept low on purpose. Ambient lifts every surface equally, which is
          exactly what destroys form on a white object — the environment below
          is what should be doing the lighting. */}
      <ambientLight intensity={0.12} />

      {/* The only shadow-caster. Softened by a large map and a tight frustum. */}
      <directionalLight
        position={[2.6, 4, 3]}
        intensity={0.85}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={12}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />

      <Environment resolution={256}>
        {/* Large soft key, upper right — the main highlight roll-off. */}
        <Lightformer
          form="rect"
          intensity={1.9}
          position={[3, 4, 3]}
          scale={[6, 6, 1]}
          target={[0, 0, 0]}
        />
        {/* Broad cool fill from the left, so the shadow side stays readable. */}
        <Lightformer
          form="rect"
          intensity={0.65}
          color="#dfe6ef"
          position={[-5, 1.5, 2]}
          scale={[6, 8, 1]}
          target={[0, 0, 0]}
        />
        {/* Rim strip behind: the bright edge that separates it from the page. */}
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[0, 2, -5]}
          scale={[8, 3, 1]}
          target={[0, 0, 0]}
        />
        {/* Bounce from below, standing in for light off the floor. Carries
            more weight than a typical rig because the tentacles hang under
            the body, where the key light never reaches them. */}
        <Lightformer
          form="rect"
          intensity={1.15}
          color="#ffffff"
          position={[0, -3, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[6, 6, 1]}
        />
      </Environment>

      {/* Grounding. Higher resolution and more blur than a plain shadow map,
          which is what keeps the contact soft instead of a hard ellipse. */}
      <ContactShadows
        position={[0, -1.34, 0]}
        opacity={0.5}
        scale={6}
        blur={3.2}
        far={2.2}
        resolution={512}
        color="#101014"
      />
    </>
  );
}
