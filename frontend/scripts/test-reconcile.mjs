// Tests lib/reconcile.js: what sync does on sign-in.
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

// ── merging a newer copy from another device ────────────────────────────────
// The phone slept through a note added on the laptop, then got one of its own.
// Both notes must survive, whichever side sends last.
{
  const { merge } = await import("../src/lib/reconcile.js");
  const a = { id: "a", text: "old" };
  const base = { notes: [a], textSize: 1, timer: null };
  const laptop = { notes: [a, { id: "laptop", text: "from laptop" }], textSize: 1, timer: null };
  const phone = { notes: [a, { id: "phone", text: "from phone" }], textSize: 1.2, timer: null };

  const merged = merge(base, phone, laptop);
  assert.deepEqual(merged.notes.map(n => n.id), ["a", "laptop", "phone"], "both adds survive");
  assert.equal(merged.textSize, 1.2, "a field changed here wins");

  // A delete on either side sticks; an edit here beats the copy over there.
  const delHere = merge(base, { ...base, notes: [] }, laptop);
  assert.deepEqual(delHere.notes.map(n => n.id), ["laptop"], "deleted here stays deleted");
  const delThere = merge(base, base, { ...base, notes: [] });
  assert.deepEqual(delThere.notes, [], "deleted there stays deleted");
  const edited = merge(base, { ...base, notes: [{ id: "a", text: "new" }] }, laptop);
  assert.equal(edited.notes[0].text, "new", "local edit kept");
  assert.equal(merge(base, base, laptop).notes.length, 2, "nothing local: take theirs");

  // Edited here but deleted over there: keep the edit rather than lose it.
  const kept = merge(base, { ...base, notes: [{ id: "a", text: "new" }] }, { ...base, notes: [] });
  assert.deepEqual(kept.notes.map(n => n.text), ["new"]);

  // No base (fresh load): nothing local is dropped.
  assert.deepEqual(merge(undefined, phone, laptop).notes.map(n => n.id), ["a", "laptop", "phone"]);
}

console.log("reconcile: ok");
