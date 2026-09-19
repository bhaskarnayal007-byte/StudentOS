import assert from "node:assert/strict";

const { reconcile } = await import("../src/lib/reconcile.js");

// ── first sign-in, nothing on the server ────────────────────────────────────
// This is the localStorage-to-cloud migration: existing data goes up.
assert.deepEqual(reconcile({ remote: null, localRev: 0, hasLocalData: true }), { action: "push" });
assert.deepEqual(reconcile({ remote: null, localRev: 0, hasLocalData: false }), { action: "none" });

// ── another device has written since we last looked ─────────────────────────
assert.deepEqual(
  reconcile({ remote: { data: {}, rev: 200 }, localRev: 100, hasLocalData: true }),
  { action: "adopt" },
);

// ── we are level with the server: our copy is the newest, send it ───────────
assert.deepEqual(
  reconcile({ remote: { data: {}, rev: 100 }, localRev: 100, hasLocalData: true }),
  { action: "push" },
);

// ── our last push never landed, so we are ahead ─────────────────────────────
assert.deepEqual(
  reconcile({ remote: { data: {}, rev: 50 }, localRev: 100, hasLocalData: true }),
  { action: "push" },
);

// ── offline first load ──────────────────────────────────────────────────────
// The one that matters: a failed fetch must not look like an empty account, or
// the first push wipes the server.
assert.deepEqual(
  reconcile({ remote: undefined, localRev: 0, hasLocalData: false }),
  { action: "wait" },
);

console.log("cloud sync: ok");
