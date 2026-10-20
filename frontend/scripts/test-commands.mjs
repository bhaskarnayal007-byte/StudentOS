import assert from "node:assert/strict";

const { matchCommand } = await import("../src/ai/commands.js");

// A fixed "now": Wednesday 2026-10-14, 10:00 local.
const now = new Date(2026, 9, 14, 10, 0);
const m = (text) => matchCommand(text, now);

// ── timer ───────────────────────────────────────────────────────────────────
assert.deepEqual(m("25 min timer"), { name: "start_timer", args: { minutes: 25, label: undefined } });
assert.deepEqual(m("Set a 10 minute timer for laundry"), { name: "start_timer", args: { minutes: 10, label: "laundry" } });
assert.deepEqual(m("timer 5"), { name: "start_timer", args: { minutes: 5, label: undefined } });

// ── tasks ───────────────────────────────────────────────────────────────────
assert.deepEqual(m("add task buy milk"), { name: "add_task", args: { text: "buy milk", due: undefined } });
assert.deepEqual(m("todo: essay due friday"), { name: "add_task", args: { text: "essay", due: "2026-10-16" } });
assert.deepEqual(m("task call mom tomorrow"), { name: "add_task", args: { text: "call mom", due: "2026-10-15" } });
// A weekday is the NEXT one, never today.
assert.equal(m("todo gym wednesday").args.due, "2026-10-21");

assert.deepEqual(m("done buy milk"), { name: "complete_task", args: { text: "buy milk" } });
assert.deepEqual(m("mark essay as done"), { name: "complete_task", args: { text: "essay" } });
// "mark X as learned" is a mind-map thing, not a task: leave it to the AI.
assert.equal(m("mark chapter 3 as learned"), null);

// ── alarms ──────────────────────────────────────────────────────────────────
assert.deepEqual(m("alarm 7:30"), { name: "set_alarm", args: { datetime: "2026-10-15T07:30", label: "Alarm" } });
assert.deepEqual(m("alarm at 2pm"), { name: "set_alarm", args: { datetime: "2026-10-14T14:00", label: "Alarm" } });
assert.deepEqual(m("set an alarm at 6am tomorrow for gym"), { name: "set_alarm", args: { datetime: "2026-10-15T06:00", label: "gym" } });
assert.equal(m("alarm 13pm"), null);

// ── money, notes, subjects ──────────────────────────────────────────────────
assert.deepEqual(m("spent 200 on food"), { name: "add_expense", args: { amount: 200, category: "Food" } });
assert.deepEqual(m("₹150 travel"), { name: "add_expense", args: { amount: 150, category: "Travel" } });
assert.deepEqual(m("note: bring the lab coat"), { name: "add_note", args: { text: "bring the lab coat" } });
assert.deepEqual(m("add subject Organic Chemistry"), { name: "add_course", args: { name: "Organic Chemistry" } });

// ── everything else goes to the AI ──────────────────────────────────────────
assert.equal(m("what's due this week?"), null);
assert.equal(m("can you make a study plan for chem"), null);
assert.equal(m(""), null);

console.log("commands: ok");
