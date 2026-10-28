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

// The floor: an even split across a huge user count must not reach zero.
const floored = tokenBudget({ windowMs: 60_000, max: () => Math.floor(600_000 / 1_000_000), floor: 30_000 });
floored.spend("f", 29_999);
assert.equal(run(floored, "f").passed, true, "a 0-token share still gets the floor");
floored.spend("f", 1);
assert.equal(run(floored, "f").status, 429, "and is refused once past it");

// The global cap: the floor can't let everyone together overspend the key.
const capped = tokenBudget({ windowMs: 60_000, max: 100, total: 150 });
capped.spend("g1", 80);
capped.spend("g2", 80);
const out = run(capped, "g3");
assert.equal(out.passed, false, "a fresh user is refused once the total is spent");
assert.equal(out.status, 503, "with a status distinct from the per-user 429");
assert.equal(out.body.code, "ai_capacity_exhausted");
assert.match(out.body.error, /for everyone/, "and a message that doesn't blame the user");
assert.ok(out.headers["Retry-After"], "sends Retry-After");

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

// ── ai route: max_tokens ────────────────────────────────────────────────────
// The route reads its env at import and talks to Supabase and the provider
// through fetch, so fake both and call the final handler directly.
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
process.env.AI_API_KEY = "test";
delete process.env.AI_PROVIDERS;
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith("/chat/completions")) sent.push(JSON.parse(init.body));
  return Response.json({ choices: [], usage: { total_tokens: 1 } });
};
const { default: aiRouter } = await import("../src/routes/ai.js");
const handlers = aiRouter.stack[0].route.stack;
const generate = handlers[handlers.length - 1].handle;

const aiRes = { set() {}, status() { return this; }, json() { return this; } };
await generate(
  { user: { id: "m" }, body: { messages: [{ role: "user", content: "hi" }], max_tokens: 1_000_000 } },
  aiRes,
  (err) => { throw err; },
);
assert.equal(sent.length, 1, "the request reached the provider");
assert.equal(sent[0].max_tokens, 2048, "the client can't raise max_tokens");

console.log("middleware checks passed");
