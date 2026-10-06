import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import Lighting from "./Lighting";
import OctopusModel, { type Mood } from "./OctopusModel";

const CAPTION: Record<Mood, string> = {
  idle: "Ask me anything",
  happy: "Ask me anything",
  focus: "Focusing with you",
  sleeping: "Zzz… tap to wake me",
};

/**
 * The mascot canvas, sized by its container. Rendered only on the home page —
 * it runs a continuous animation loop, so mounting it app-wide would burn a
 * frame budget on every screen that never shows it.
 *
 * `mood` comes from the app (timer running, time of day); hovering turns an
 * idle Octi happy. The sparkle and the z's are HTML over the canvas: flat
 * glyphs, as on the brand sheet, not 3D objects.
 */
export default function OctopusMascot({ onClick, mood = "idle" }: { onClick: () => void; mood?: Mood }) {
  const [hovered, setHovered] = useState(false);
  const shown: Mood = mood === "idle" && hovered ? "happy" : mood;

  return (
    <button
      className="mascot-button"
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-label="Open the assistant"
    >
      <div className={`mascot-stage mascot-${shown}`}>
        <Canvas
          // Cap at 2: past that it costs 4x the pixels for no visible gain.
          dpr={[1, 2]}
          shadows={{ type: PCFSoftShadowMap }}
          // A longer lens (lower fov, camera further back) flattens the
          // perspective. Wide-angle on a small round character bulges the
          // near side and is a large part of why it looked cheap.
          camera={{ position: [0, 0.2, 9.4], fov: 22 }}
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
          <OctopusModel mood={shown} />
        </Canvas>

        <span className="mascot-sparkle" aria-hidden>✦</span>
        {shown === "sleeping" && (
          <span className="mascot-zzz" aria-hidden>
            <span>z</span><span>z</span><span>Z</span>
          </span>
        )}
      </div>
      <span className="mascot-caption">{CAPTION[shown]}</span>
    </button>
  );
}
