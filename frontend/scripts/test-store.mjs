import assert from "node:assert/strict";

// The reducer is plain JS inside a .jsx file, so it's re-declared here as the
// smallest thing that can test the rule: a finished timer logs exactly one
// session however many times the component tells us about it.
//
// (Kept in step with the 'log-focus' case in src/store.jsx.)
function logFocus(state, action) {
  return state.focusSessions.some((f) => f.endedAt === action.endedAt)
    ? state
    : {
        ...state,
        focusSessions: [
          ...state.focusSessions,
          { id: "generated", endedAt: action.endedAt, minutes: action.minutes },
        ],
      };
}

let state = { focusSessions: [] };
const run = { type: "log-focus", endedAt: 1790889693597, minutes: 25 };

state = logFocus(state, run);
assert.equal(state.focusSessions.length, 1);

// The bug this exists to stop: a remount replays the same finished timer.
state = logFocus(state, run);
state = logFocus(state, run);
assert.equal(state.focusSessions.length, 1, "the same run is logged once");

// A genuinely different run still lands.
state = logFocus(state, { ...run, endedAt: run.endedAt + 60_000 });
assert.equal(state.focusSessions.length, 2);

console.log("store: ok");
