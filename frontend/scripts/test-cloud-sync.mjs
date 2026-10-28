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

// ── a push goes out only when the account's data changed ────────────────────
// Same gate as push() in cloudSync.js, with the network swapped for a counter:
// skip what the server holds, and record a write only once it has landed.
const { isOnServer, markOnServer } = await import("../src/lib/reconcile.js");
let writes = 0;
function push(state, { fails = false } = {}) {
  if (isOnServer("u1", state)) return "skipped";
  writes++;
  if (fails) return null;
  markOnServer("u1", state);
  return "sent";
}

const base = { theme: "dark", ownerId: "u1", tasks: [{ id: 1, title: "a" }] };
assert.equal(push(base), "sent");
assert.equal(push({ ...base }), "skipped", "unchanged state");
assert.equal(push({ ...base, theme: "system" }), "skipped", "theme is device-only");
const edited = { ...base, tasks: [{ id: 1, title: "b" }] };
assert.equal(push(edited), "sent", "real change");

// A failed save is retried even though nothing changed since.
const failing = { ...edited, notes: [{ id: 2 }] };
assert.equal(push(failing, { fails: true }), null);
assert.equal(push(failing), "sent", "retry after failure");
assert.equal(push(failing), "skipped");
assert.equal(writes, 4);

// What the server sent back (jsonb reorders keys) and was then applied locally
// must not be echoed up again; a reordered array is a real change.
markOnServer("u2", { tasks: [{ title: "b", id: 2 }], notes: [] });
assert.ok(isOnServer("u2", { ownerId: "u2", theme: "dark", notes: [], tasks: [{ id: 2, title: "b" }] }));
markOnServer("u2", { tasks: [{ id: 1 }, { id: 2 }] });
assert.ok(!isOnServer("u2", { tasks: [{ id: 2 }, { id: 1 }] }));

console.log("cloud sync: ok");
