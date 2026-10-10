/**
 * The Student OS mark — a ship's wheel — drawn as SVG so it can be animated,
 * scaled to any size and coloured by CSS (it paints in currentColor).
 * Proportions follow public/logo-mark.png: an outer rim, eight spokes to a
 * solid hub, and eight round handles on short shafts.
 *
 * `intro` plays the build-up once: the rim draws itself, spokes grow from the
 * hub, the handles pop on in turn and the wheel spins to a stop. The motion
 * lives in theme.css (.wheel-intro) and is skipped under reduced motion.
 */
const C = 256;
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const RIM = 118;
const RIM_LEN = Math.round(2 * Math.PI * RIM);

export default function LogoWheel({
  size = 40,
  intro = false,
  className = "",
  title,
}: {
  size?: number | string;
  intro?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`wheel${intro ? " wheel-intro" : ""}${className ? ` ${className}` : ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ "--rim-len": RIM_LEN } as React.CSSProperties}
    >
      <g className="wheel-turn">
        {/* The outer <g> holds each piece's angle; the inner element is what
            animates. A CSS transform on the rotated element itself would
            replace its rotate() and stack every piece at the top. */}
        {ANGLES.map((a, i) => (
          <g key={`h${a}`} transform={`rotate(${a} ${C} ${C})`}>
            <g className="wheel-handle" style={{ "--i": i } as React.CSSProperties}>
              <rect x={C - 7} y={C - 160} width={14} height={36} rx={4} fill="currentColor" />
              <circle cx={C} cy={C - 182} r={27} fill="currentColor" />
            </g>
          </g>
        ))}

        {ANGLES.map((a, i) => (
          <g key={`s${a}`} transform={`rotate(${a} ${C} ${C})`}>
            <line
              className="wheel-spoke"
              x1={C}
              y1={C}
              x2={C}
              y2={C - RIM + 4}
              stroke="currentColor"
              strokeWidth={11}
              strokeLinecap="round"
              style={{ "--i": i } as React.CSSProperties}
            />
          </g>
        ))}

        <circle className="wheel-rim" cx={C} cy={C} r={RIM} fill="none" stroke="currentColor" strokeWidth={16} />
        <circle className="wheel-hub" cx={C} cy={C} r={30} fill="currentColor" />
      </g>
    </svg>
  );
}
