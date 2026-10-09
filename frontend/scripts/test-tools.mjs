import assert from "node:assert/strict";

// No `window` in node, so confirmDestructive() auto-approves — the deletion
// paths below are exercised as if the user had said yes.
const { runTool } = await import("../src/ai/tools.js");

/** A store stand-in: applies only the actions these tools dispatch. */
function makeStore(state) {
  return {
    state,
    dispatch(action) {
      if (action.type === "add-expense") {
        state.expenses.push({ id: "generated", ...action.expense });
      } else if (action.type === "delete-expense") {
        state.expenses = state.expenses.filter((e) => e.id !== action.id);
      } else if (action.type === "delete-task") {
        state.tasks = state.tasks.filter((t) => t.id !== action.id);
      }
    },
  };
}

// ── add_expense ─────────────────────────────────────────────────────────────
let store = makeStore({ tasks: [], expenses: [] });
runTool("add_expense", { amount: 120, category: "Food", date: "2026-09-01" }, store);
assert.equal(store.state.expenses.length, 1);
assert.equal(store.state.expenses[0].amount, 120);

// A missing date is today's, not a crash or an empty string.
store = makeStore({ tasks: [], expenses: [] });
runTool("add_expense", { amount: 50, category: "Travel" }, store);
assert.match(store.state.expenses[0].date, /^\d{4}-\d{2}-\d{2}$/);

// The model can hand us nonsense; it must be refused, not stored.
store = makeStore({ tasks: [], expenses: [] });
assert.match(runTool("add_expense", { amount: -5, category: "Food" }, store), /positive/);
assert.match(runTool("add_expense", { amount: 10, category: "Food", date: "Sept 1" }, store), /YYYY-MM-DD/);
assert.equal(store.state.expenses.length, 0, "nothing invalid was stored");

// ── delete_expense ──────────────────────────────────────────────────────────
store = makeStore({
  tasks: [],
  expenses: [
    { id: "a", amount: 200, category: "Books", date: "2026-09-02", note: "notebook" },
    { id: "b", amount: 90, category: "Food", date: "2026-09-02", note: "" },
  ],
});
runTool("delete_expense", { text: "notebook" }, store);
assert.deepEqual(store.state.expenses.map((e) => e.id), ["b"], "matched on the note");

// Falls back to the category when no note matches.
runTool("delete_expense", { text: "food" }, store);
assert.equal(store.state.expenses.length, 0);

// Nothing matching must be reported, never guessed at.
assert.match(runTool("delete_expense", { text: "rent" }, store), /No expense matching/);

console.log("tools: ok");

// ── courses ─────────────────────────────────────────────────────────────────
store = makeStore({ tasks: [], expenses: [], courses: [] });
store.dispatch = (a) => {
  if (a.type === "add-course") store.state.courses.push({ id: "c1", ...a.course });
  if (a.type === "add-task") store.state.tasks.push({ id: "t1", ...a.task });
};

runTool("add_course", { name: "Organic Chemistry" }, store);
assert.equal(store.state.courses.length, 1);
assert.equal(store.state.courses[0].color?.startsWith("#"), true, "gets a colour");

// The same subject twice is a no-op, not a duplicate.
assert.match(runTool("add_course", { name: "organic chemistry" }, store), /already/);
assert.equal(store.state.courses.length, 1);

// A partial name still finds the subject — the model says "chem".
runTool("add_task", { text: "Lab report", course: "chem" }, store);
assert.equal(store.state.tasks[0].courseId, "c1", "linked by partial name");

// The one that matters: a subject the model invented must not create a
// dangling link to something that doesn't exist.
runTool("add_task", { text: "Essay", course: "Astrophysics" }, store);
assert.equal(store.state.tasks[1].courseId, undefined, "unknown subject means none");

console.log("courses: ok");

// ── add_topics / mark_topic_learned / delete_topic ─────────────────────────
// The store stand-in applies dispatches immediately, but the tool must not rely
// on that: in the app, state only refreshes between the model's turns.
function topicStore() {
  const state = { courses: [{ id: "c1", name: "Chemistry" }], topics: [] };
  const frozen = { ...state, topics: [] }; // what the tool sees: never updated
  return {
    state,
    view: { state: frozen, dispatch(a) {
      if (a.type === "add-topic") state.topics.push({ done: false, collapsed: false, ...a.topic });
      if (a.type === "update-topic") state.topics = state.topics.map((t) => (t.id === a.id ? { ...t, ...a.changes } : t));
      if (a.type === "delete-topic") state.topics = state.topics.filter((t) => t.id !== a.id);
    } },
  };
}

let ts = topicStore();
let said = runTool("add_topics", {
  course: "chem",
  topics: [{ name: "Organic", subtopics: [{ name: "Alkanes" }, { name: "Alkenes" }] }, { name: "Physical" }],
}, ts.view);
assert.equal(ts.state.topics.length, 4, said);
const organic = ts.state.topics.find((t) => t.text === "Organic");
assert.equal(organic.parentId, null);
assert.deepEqual(
  ts.state.topics.filter((t) => t.parentId === organic.id).map((t) => t.text),
  ["Alkanes", "Alkenes"],
  "sub-topics hang off the topic made in the same call",
);

// Adding under an existing topic, found by a loose name.
ts.view.state = { ...ts.state, topics: [...ts.state.topics] };
runTool("add_topics", { course: "Chemistry", parent: "organic", topics: [{ name: "Alkynes" }] }, ts.view);
assert.equal(ts.state.topics.find((t) => t.text === "Alkynes").parentId, organic.id);

// Unknown subject or parent: nothing added, and the model is told why.
assert.match(runTool("add_topics", { course: "History", topics: [{ name: "X" }] }, ts.view), /no subject/i);
assert.match(runTool("add_topics", { course: "Chemistry", parent: "Nuclear", topics: [{ name: "X" }] }, ts.view), /no topic/i);
assert.equal(ts.state.topics.length, 5);

ts.view.state = { ...ts.state, topics: [...ts.state.topics] };
runTool("mark_topic_learned", { course: "chem", topic: "Alkanes" }, ts.view);
assert.equal(ts.state.topics.find((t) => t.text === "Alkanes").done, true);

console.log("topics tools: ok");
