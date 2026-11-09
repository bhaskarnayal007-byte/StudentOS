import assert from "node:assert/strict";
import { DEFAULTS, halves, move, resolve } from "../src/lib/homeLayout.js";

// Nothing saved: the default.
assert.deepEqual(resolve(undefined, "wide"), { order: DEFAULTS.wide, hidden: [] });

// A saved order wins; islands it predates are added at the end; unknown ones dropped.
let r = resolve({ order: ["notes", "octi", "tasks", "gone"], hidden: ["timer", "octi", "gone"] }, "wide");
assert.deepEqual(r.order.slice(0, 3), ["notes", "octi", "tasks"]);
assert.equal(r.order.length, DEFAULTS.wide.length, "every island present once");
assert.deepEqual(r.hidden, ["timer"], "Octi can't be hidden");

// Phones never list Friends or Shortcuts.
assert.ok(!resolve({ order: ["friends", "shortcuts"] }, "phone").order.some((id) => id === "friends" || id === "shortcuts"));

// Moving swaps with the neighbour, and stops at the ends.
assert.deepEqual(move(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
assert.deepEqual(move(["a", "b", "c"], "c", 1), ["a", "b", "c"]);

// Timer and Spending share a row only when they're next to each other.
assert.deepEqual([...halves(["tasks", "timer", "finance"])], ["timer", "finance"]);
assert.equal(halves(["timer", "tasks", "finance"]).size, 0);

console.log("home layout: ok");
