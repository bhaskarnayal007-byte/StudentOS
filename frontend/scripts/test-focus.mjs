import assert from "node:assert/strict";

const { formatSpan } = await import("../src/lib/focus.js");

assert.equal(formatSpan(0), "0m");
assert.equal(formatSpan(45), "45m");
assert.equal(formatSpan(60), "1h");
assert.equal(formatSpan(90), "1h 30m");
assert.equal(formatSpan(125), "2h 5m");

console.log("focus: ok");

// ── the week ────────────────────────────────────────────────────────────────
const { lastSevenDays } = await import("../src/lib/focus.js");
const now = new Date("2026-10-01T20:00:00");
const day = (daysBack, minutes) => ({
  endedAt: new Date("2026-10-01T12:00:00").getTime() - daysBack * 86_400_000,
  minutes,
});

const week = lastSevenDays([day(0, 25), day(0, 50), day(2, 30)], now);

assert.equal(week.length, 7, "always seven buckets");
assert.equal(week.at(-1).minutes, 75, "today's sessions add up");
assert.equal(week[4].minutes, 30, "two days ago");
// An empty day must stay in the week — a gap is information, so the chart
// must not silently close up around it.
assert.equal(week[5].minutes, 0);
assert.equal(week.filter((d) => d.minutes === 0).length, 5);

// Anything older than the window is outside it, not folded into day one.
assert.equal(lastSevenDays([day(30, 999)], now).reduce((s, d) => s + d.minutes, 0), 0);

console.log("focus week: ok");
