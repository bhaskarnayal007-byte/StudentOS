import { useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// The idle state machine. Picks one of four behaviours, holds it for a few
// seconds, then picks a different one — never the same twice in a row.
//
// It is a hook rather than the <IdleStateMachine /> component the brief
// sketched: in react-three-fiber, animation runs in useFrame against mesh
// refs, so a child component would have to receive every ref as a prop and
// render nothing. Same separation, without the prop plumbing.
// ─────────────────────────────────────────────────────────────────────────────

export type IdleState = "blinkLook" | "legSway" | "headBob" | "hop";

const STATES: IdleState[] = ["blinkLook", "legSway", "headBob", "hop"];

/** How long each behaviour holds, in seconds. Hop is shortest — repeated
 *  hopping reads as agitated rather than idle. */
const DURATION: Record<IdleState, [number, number]> = {
  blinkLook: [2.6, 4.2],
  legSway: [3.0, 4.5],
  headBob: [2.8, 4.0],
  hop: [1.6, 2.4],
};

const randomBetween = ([min, max]: [number, number]) =>
  min + Math.random() * (max - min);

export function useIdleState() {
  const state = useRef<IdleState>("headBob");
  // Seconds elapsed inside the current state — animations key off this rather
  // than absolute clock time, so each behaviour starts from a known phase.
  const elapsed = useRef(0);
  const holdFor = useRef(randomBetween(DURATION.headBob));

  /** Call once per frame with the frame delta. */
  function advance(delta: number) {
    elapsed.current += delta;
    if (elapsed.current < holdFor.current) return;

    const options = STATES.filter((s) => s !== state.current);
    const next = options[Math.floor(Math.random() * options.length)];

    state.current = next;
    elapsed.current = 0;
    holdFor.current = randomBetween(DURATION[next]);
  }

  // holdFor is exposed so the animation can build a fade-in/fade-out envelope
  // from how far through the state it is — that cross-fade is what keeps
  // switching behaviours from snapping.
  return { state, elapsed, holdFor, advance };
}
