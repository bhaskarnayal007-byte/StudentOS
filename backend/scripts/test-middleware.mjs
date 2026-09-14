import assert from "node:assert/strict";
import rateLimit from "../src/middleware/rateLimit.js";

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
