// ─────────────────────────────────────────────────────────────────────────────
// "Which interactive element is the cursor on, and where is it on screen" —
// a module-level value the mascot polls every frame inside useFrame.
//
// Deliberately NOT React state or context: a value read per frame needs no
// re-render, and routing hover through React would re-render the whole
// subtree on each mousemove.
// ─────────────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], summary';

let target: Point | null = null;
let started = false;

function onPointerOver(event: Event) {
  const el = (event.target as Element | null)?.closest?.(INTERACTIVE);
  if (!el) {
    target = null;
    return;
  }
  const r = el.getBoundingClientRect();
  target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function onPointerOut(event: Event) {
  // relatedTarget is where the cursor went next. If it's still inside an
  // interactive element, leave the target alone — otherwise moving across a
  // button's own child spans would flicker the eyes.
  const next = (event as PointerEvent).relatedTarget as Element | null;
  if (next?.closest?.(INTERACTIVE)) return;
  target = null;
}

/** Starts the listeners once, on first read. */
function start() {
  if (started || typeof document === "undefined") return;
  started = true;
  document.addEventListener("pointerover", onPointerOver, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  // A hovered element can move out from under the cursor.
  window.addEventListener("scroll", () => (target = null), { passive: true });
}

/** Current hovered element's centre in client coordinates, or null. */
export function getHoverTarget() {
  // The listeners used to start only on subscribe, which nothing ever called,
  // so the eyes never followed the cursor. The first frame's read starts them.
  start();
  return target;
}
