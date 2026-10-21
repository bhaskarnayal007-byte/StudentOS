import assert from "node:assert/strict";

const { toPayload, importShare, describe } = await import("../src/lib/shareCopy.js");

/** Records what importShare dispatches, applying the actions it uses. */
function makeStore(state) {
  const store = { state, dispatch(a) {
    if (a.type === "add-note") state.notes.push(a.note);
    else if (a.type === "add-event") state.events.push(a.event);
    else if (a.type === "add-course") state.courses.push(a.course);
    else if (a.type === "add-topic") state.topics.push(a.topic);
  } };
  return store;
}
const empty = () => ({ notes: [], events: [], courses: [], topics: [] });

// ── note ────────────────────────────────────────────────────────────────────
const note = { id: "n1", text: "Krebs cycle\nhappens in the mitochondria", pdf: { name: "x.pdf" } };
let share = { kind: "note", payload: toPayload("note", note, empty()) };
assert.deepEqual(share.payload, { text: note.text }); // no attachment, no id
assert.equal(describe(share), "Krebs cycle");
let b = makeStore(empty());
importShare(share, b.state, b.dispatch);
assert.equal(b.state.notes[0].text, note.text);

// ── event ───────────────────────────────────────────────────────────────────
share = { kind: "event", payload: toPayload("event", { id: "e", title: "Lab", date: "2026-10-22", time: "14:00", source: "event" }) };
b = makeStore(empty());
importShare(share, b.state, b.dispatch);
assert.deepEqual(b.state.events, [{ title: "Lab", date: "2026-10-22", time: "14:00" }]);
assert.throws(() => importShare({ kind: "event", payload: { title: "x", date: "soon" } }, b.state, b.dispatch));

// ── mind map ────────────────────────────────────────────────────────────────
const a = {
  ...empty(),
  courses: [{ id: "c1", name: "Chemistry" }],
  topics: [
    { id: "t1", courseId: "c1", parentId: null, text: "Organic", done: true },
    { id: "t2", courseId: "c1", parentId: "t1", text: "Alkanes", done: false },
    { id: "t3", courseId: "c1", parentId: null, text: "Physical", done: false },
  ],
};
share = { kind: "map", payload: toPayload("map", a.courses[0], a) };
assert.equal(describe(share), "Chemistry");

// New subject: created, tree rebuilt with fresh ids, learned flags kept.
b = makeStore(empty());
importShare(share, b.state, b.dispatch);
assert.equal(b.state.courses.length, 1);
const [organic, alkanes, physical] = b.state.topics;
assert.equal(organic.text, "Organic");
assert.equal(organic.done, true);
assert.equal(alkanes.parentId, organic.id);
assert.equal(physical.parentId, null);
assert.ok(b.state.topics.every(t => t.courseId === b.state.courses[0].id && !["t1", "t2", "t3"].includes(t.id)));

// Same-named subject already there: merged into it, no twin.
b = makeStore({ ...empty(), courses: [{ id: "mine", name: "chemistry" }] });
importShare(share, b.state, b.dispatch);
assert.equal(b.state.courses.length, 1);
assert.ok(b.state.topics.every(t => t.courseId === "mine"));

console.log("share: ok");
