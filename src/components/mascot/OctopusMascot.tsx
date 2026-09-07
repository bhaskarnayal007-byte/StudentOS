import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import Lighting from "./Lighting";
import OctopusModel from "./OctopusModel";

/**
 * The mascot canvas, sized by its container. Rendered only on the home page —
 * it runs a continuous animation loop, so mounting it app-wide would burn a
 * frame budget on every screen that never shows it.
 */
export default function OctopusMascot({ onClick }: { onClick: () => void }) {
  return (
    <button className="mascot-button" onClick={onClick} aria-label="Open the assistant">
      <div className="mascot-stage">
        <Canvas
          // Cap at 2: past that it costs 4x the pixels for no visible gain.
          dpr={[1, 2]}
          shadows={{ type: PCFSoftShadowMap }}
          // A longer lens (lower fov, camera further back) flattens the
          // perspective. Wide-angle on a small round character bulges the
          // near side and is a large part of why it looked cheap.
          camera={{ position: [0, 0.3, 7.4], fov: 22 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            // Filmic roll-off instead of clipping highlights to flat white,
            // which is what keeps the lit side of a white object from
            // blowing out into a featureless blob.
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
        >
          <Lighting />
          <OctopusModel />
        </Canvas>
      </div>
      <span className="mascot-caption">Ask me anything</span>
    </button>
  );
}
