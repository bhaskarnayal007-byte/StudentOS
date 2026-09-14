// ─────────────────────────────────────────────────────────────────────────────
// A tiny app-wide store of "which interactive element is the cursor on, and
// where is it on screen".
//
// Deliberately NOT React context: the mascot reads this every frame inside
// useFrame, and routing it through context would re-render the whole subtree
// on each hover. A module-level value plus a subscribe callback keeps the
// hover signal completely out of React's render cycle.
// ─────────────────────────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], summary';

let target: Point | null = null;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const listener of listeners) listener();
}

function setTarget(next: Point | null) {
  // Skip no-op updates so we aren't waking subscribers on every mousemove.
  if (next === null && target === null) return;
  if (next && target && next.x === target.x && next.y === target.y) return;
  target = next;
  emit();
}

function onPointerOver(event: Event) {
  const el = (event.target as Element | null)?.closest?.(INTERACTIVE);
  if (!el) return setTarget(null);
  const r = el.getBoundingClientRect();
  setTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
}

function onPointerOut(event: Event) {
  // relatedTarget is where the cursor went next. If it's still inside an
  // interactive element, leave the target alone — otherwise moving across a
  // button's own child spans would flicker the eyes.
  const next = (event as PointerEvent).relatedTarget as Element | null;
  if (next?.closest?.(INTERACTIVE)) return;
  setTarget(null);
}

/** Starts the listeners once, on first subscriber. */
function start() {
  if (started || typeof document === "undefined") return;
  started = true;
  document.addEventListener("pointerover", onPointerOver, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  // A hovered element can move out from under the cursor.
  window.addEventListener("scroll", () => setTarget(null), { passive: true });
}

export function subscribeHover(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current hovered element's centre in client coordinates, or null. */
export function getHoverTarget() {
  return target;
}
