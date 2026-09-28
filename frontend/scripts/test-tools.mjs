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
