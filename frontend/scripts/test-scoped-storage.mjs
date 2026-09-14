import assert from "node:assert/strict";

// Minimal localStorage stand-in — the module only uses these three methods.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { readScoped, writeScoped, scopedKey } = await import("../src/lib/scopedStorage.js");

const BASE = "student-os-state";
const reset = () => store.clear();

// ── keys ────────────────────────────────────────────────────────────────────
assert.equal(scopedKey(BASE, "u1"), "student-os-state:u1");
assert.equal(scopedKey(BASE, null), "student-os-state", "signed out falls back to the bare key");

// ── the migration: existing data must survive the first sign-in ─────────────
reset();
store.set(BASE, '{"tasks":["mine"]}');

assert.equal(readScoped(BASE, "u1"), '{"tasks":["mine"]}', "first account adopts pre-account data");
assert.equal(store.get("student-os-state:u1"), '{"tasks":["mine"]}', "and it is copied to their key");
assert.equal(store.has(BASE), false, "the shared copy is removed");

// This is the leak the whole change exists to close.
assert.equal(readScoped(BASE, "u2"), null, "a second account inherits nothing");

// ── accounts do not see each other ──────────────────────────────────────────
reset();
writeScoped(BASE, "u1", "one");
writeScoped(BASE, "u2", "two");
assert.equal(readScoped(BASE, "u1"), "one");
assert.equal(readScoped(BASE, "u2"), "two");

// ── an account with its own data ignores anything unscoped ─────────────────
reset();
store.set(BASE, "stale");
writeScoped(BASE, "u1", "mine");
assert.equal(readScoped(BASE, "u1"), "mine", "own slice wins over the shared key");
// Cleared even though nothing was adopted: an unscoped copy left lying around
// is exactly what a future account would inherit.
assert.equal(store.has(BASE), false, "the shared key is cleared anyway");

// ── legacy keys migrate too, and are cleared ───────────────────────────────
reset();
store.set("day-deck-state", '{"tasks":["old"]}');
assert.equal(readScoped(BASE, "u1", ["day-deck-state"]), '{"tasks":["old"]}', "adopts legacy data");
assert.equal(store.get("student-os-state:u1"), '{"tasks":["old"]}');
assert.equal(store.has("day-deck-state"), false, "legacy key is cleared");
assert.equal(readScoped(BASE, "u2", ["day-deck-state"]), null, "and cannot leak to the next account");

// ── signed out, nothing is adopted or destroyed ────────────────────────────
reset();
store.set(BASE, "pre-account");
assert.equal(readScoped(BASE, null), "pre-account", "still readable while the session loads");
assert.equal(store.get(BASE), "pre-account", "and untouched — no user to give it to yet");

// ── nothing stored ──────────────────────────────────────────────────────────
reset();
assert.equal(readScoped(BASE, "u1"), null);
assert.equal(readScoped(BASE, null), null);

// ── storage refused (private mode) must not throw ──────────────────────────
globalThis.localStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};
assert.equal(readScoped(BASE, "u1"), null, "read survives blocked storage");
assert.doesNotThrow(() => writeScoped(BASE, "u1", "x"), "write survives blocked storage");

console.log("scoped storage checks passed");
