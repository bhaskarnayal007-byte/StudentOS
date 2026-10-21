import assert from "node:assert/strict";
import rateLimit, { tokenBudget } from "../src/middleware/rateLimit.js";

// Fakes just big enough for the middleware's surface: it reads req.user.id /
// req.ip and calls res.status().json() or next().
function run(mw, userId) {
  const out = { status: null, body: null, passed: false, headers: {} };
  const res = {
    set: (k, v) => { out.headers[k] = v; },
    status(code) { out.status = code; return this; },
    json(body) { out.body = body; return this; },
  };
  mw({ user: { id: userId }, ip: "1.2.3.4" }, res, () => { out.passed = true; });
  return out;
}

// ── rate limit ──────────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 60_000, max: 3 });

assert.equal(run(limiter, "a").passed, true, "1st request passes");
assert.equal(run(limiter, "a").passed, true, "2nd passes");
assert.equal(run(limiter, "a").passed, true, "3rd passes");

const blocked = run(limiter, "a");
assert.equal(blocked.passed, false, "4th is blocked");
assert.equal(blocked.status, 429);
assert.ok(blocked.headers["Retry-After"], "sends Retry-After");

// The count must be per user, or one heavy user locks everyone out.
assert.equal(run(limiter, "b").passed, true, "a different user is unaffected");

// The window has to actually expire.
const shortWindow = rateLimit({ windowMs: 1, max: 1 });
assert.equal(run(shortWindow, "c").passed, true);
await new Promise((r) => setTimeout(r, 5));
assert.equal(run(shortWindow, "c").passed, true, "window resets");

// ── token budget ────────────────────────────────────────────────────────────
const budget = tokenBudget({ windowMs: 60_000, max: 100 });

assert.equal(run(budget, "t").passed, true, "fresh user passes");
budget.spend("t", 60);
assert.equal(run(budget, "t").passed, true, "under budget passes");
budget.spend("t", 60);
const broke = run(budget, "t");
assert.equal(broke.passed, false, "over budget is blocked");
assert.equal(broke.status, 429);
assert.ok(broke.headers["Retry-After"], "sends Retry-After");
assert.equal(run(budget, "u").passed, true, "one user's spending doesn't block another");
budget.spend("u", undefined); // provider omitted usage
assert.equal(run(budget, "u").passed, true, "missing usage counts as zero");

// A function limit is re-read every check: more users, smaller share.
let users = 1;
const shared = tokenBudget({ windowMs: 60_000, max: () => Math.floor(100 / users) });
shared.spend("s", 40);
assert.equal(run(shared, "s").passed, true, "40 of 100 with one user");
users = 4;
assert.equal(run(shared, "s").passed, false, "same 40 is over a 25 share once 4 users are active");
users = 2;
assert.equal(run(shared, "s").passed, true, "share grows back when users leave");

// ── allowlist ───────────────────────────────────────────────────────────────
// Read at import time from env, so set it before importing.
process.env.ALLOWED_EMAILS = "yes@example.com, MIXED@Example.com";
const { default: requireAllowedUser } = await import("../src/middleware/requireAllowedUser.js");

function runAllow(email) {
  const out = { status: null, passed: false };
  const res = { status(c) { out.status = c; return this; }, json() { return this; } };
  requireAllowedUser({ user: { email } }, res, () => { out.passed = true; });
  return out;
}

assert.equal(runAllow("yes@example.com").passed, true, "listed email passes");
assert.equal(runAllow("mixed@example.com").passed, true, "matching is case-insensitive");
assert.equal(runAllow("no@example.com").status, 403, "unlisted email gets 403");

console.log("middleware checks passed");
