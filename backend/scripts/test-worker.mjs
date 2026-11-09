// End-to-end check of the Worker (src/index.js) in plain Node, with Supabase
// and the AI providers faked at the fetch level. Run: node scripts/test-worker.mjs
import assert from "node:assert/strict";
import worker from "../src/index.js";

const SUPABASE = "https://test.supabase.co";
const env = {
  SUPABASE_URL: SUPABASE,
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  FRONTEND_URL: "https://stratus.pages.dev",
  AI_PROVIDERS: "a|https://a.test/v1|model-a|KEY_A,b|https://b.test/v1|model-b|KEY_B",
  KEY_A: "ka",
  KEY_B: "kb",
  AI_DAILY_TOKENS: "1000",
  AI_MIN_USER_TOKENS: "500",
};

// ── fake Supabase + providers ───────────────────────────────────────────────
const counters = new Map(); // what bump_ai_counter keeps in Postgres
let providerA = 200; // status provider "a" answers with
const calls = [];
let noteFiles = ["n1", "n2"]; // what's in the user's note-files folder
const removed = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const auth = new Headers(init.headers ?? input.headers).get("Authorization");
  calls.push(url.host + url.pathname);

  if (url.pathname === "/auth/v1/user") {
    return auth === "Bearer good"
      ? Response.json({ id: "11111111-1111-4111-8111-111111111111", email: "me@test.dev", created_at: "2026-01-01" })
      : Response.json({ msg: "bad jwt" }, { status: 401 });
  }
  if (url.pathname === "/rest/v1/rpc/bump_ai_counter") {
    const { p_key, p_window_seconds, p_amount } = JSON.parse(init.body);
    let c = counters.get(p_key);
    if (!c || c.reset_at <= Date.now()) c = { hits: 0, reset_at: Date.now() + p_window_seconds * 1000 };
    c.hits += p_amount;
    counters.set(p_key, c);
    return Response.json([{ hits: c.hits, reset_at: new Date(c.reset_at).toISOString() }]);
  }
  if (url.pathname === "/storage/v1/object/list/note-files") {
    assert.equal(JSON.parse(init.body).prefix, "11111111-1111-4111-8111-111111111111", "lists only the caller's folder");
    return Response.json(noteFiles.map((name) => ({ name })));
  }
  if (url.pathname === "/storage/v1/object/note-files" && init.method === "DELETE") {
    const { prefixes } = JSON.parse(init.body);
    removed.push(...prefixes);
    noteFiles = noteFiles.filter((n) => !prefixes.includes(`11111111-1111-4111-8111-111111111111/${n}`));
    return Response.json(prefixes.map((name) => ({ name })));
  }
  if (url.pathname === "/auth/v1/admin/users/11111111-1111-4111-8111-111111111111" && init.method === "DELETE") {
    assert.equal(noteFiles.length, 0, "files go before the account");
    return Response.json({});
  }
  if (url.pathname === "/rest/v1/user_state") {
    return new Response(null, { status: 200, headers: { "Content-Range": "*/2" } });
  }
  if (url.host === "a.test") {
    return providerA === 200
      ? Response.json({ choices: [{ message: { content: "hi from a" } }], usage: { total_tokens: 120 } })
      : Response.json({ error: { message: "pool spent" } }, { status: providerA });
  }
  if (url.host === "b.test") {
    return Response.json({ choices: [{ message: { content: "hi from b" } }], usage: { total_tokens: 80 } });
  }
  throw new Error(`unexpected fetch ${url}`);
};

// ── helpers ─────────────────────────────────────────────────────────────────
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
async function call(method, path, { token, origin = "https://stratus.pages.dev", body } = {}) {
  const headers = { Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await worker.fetch(
    new Request(`https://api.test${path}`, { method, headers, body: body && JSON.stringify(body) }),
    env,
    ctx,
  );
  await Promise.all(pending.splice(0));
  return res;
}
const ask = { messages: [{ role: "user", content: "hello" }] };

// ── health, CORS, auth ──────────────────────────────────────────────────────
let res = await call("GET", "/health");
assert.equal(res.status, 200);
assert.deepEqual(await res.json(), { ok: true });
assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://stratus.pages.dev");
assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");

res = await call("OPTIONS", "/api/ai/generate", { origin: "https://localhost" });
assert.equal(res.status, 204, "preflight answers");
assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://localhost", "the Android app is allowed");

res = await call("GET", "/health", { origin: "https://evil.example" });
assert.equal(res.headers.get("Access-Control-Allow-Origin"), null, "other sites get no CORS");

res = await call("GET", "/api/auth/me");
assert.equal(res.status, 401, "no token");
res = await call("GET", "/api/auth/me", { token: "bad" });
assert.equal(res.status, 401, "bad token");
res = await call("GET", "/api/auth/me", { token: "good" });
assert.equal(res.status, 200);
assert.equal((await res.json()).id, "11111111-1111-4111-8111-111111111111");

// Deleting the account removes its note files first, then the user.
res = await call("DELETE", "/api/auth/me", { token: "good" });
assert.equal(res.status, 204);
assert.deepEqual(removed.sort(), ["11111111-1111-4111-8111-111111111111/n1", "11111111-1111-4111-8111-111111111111/n2"]);

res = await call("GET", "/nope");
assert.equal(res.status, 404);

// ── Octi ────────────────────────────────────────────────────────────────────
res = await call("POST", "/api/ai/generate", { token: "good", body: { messages: [] } });
assert.equal(res.status, 400, "empty messages refused");

res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 200);
assert.equal((await res.json()).choices[0].message.content, "hi from a");
assert.equal(res.headers.get("X-AI-Provider"), "a:model-a");
assert.equal(counters.get("tok:11111111-1111-4111-8111-111111111111").hits, 120, "spend recorded for the user");
assert.equal(counters.get("tok:all").hits, 120, "and in total");

providerA = 429;
res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 200, "a spent pool falls through to the next provider");
assert.equal(res.headers.get("X-AI-Provider"), "b:model-b");

providerA = 400;
calls.length = 0;
res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 400, "a bad request stops the chain");
assert.ok(!calls.includes("b.test/v1/chat/completions"), "and b is not tried");
providerA = 200;

// Daily budget: per user is max(500 floor, 1000 / 2 active) = 500.
counters.set("tok:11111111-1111-4111-8111-111111111111", { hits: 500, reset_at: Date.now() + 60_000 });
res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 429, "user's daily share used up");
assert.ok(res.headers.get("Retry-After"));

counters.set("tok:11111111-1111-4111-8111-111111111111", { hits: 0, reset_at: Date.now() + 60_000 });
counters.set("tok:all", { hits: 1000, reset_at: Date.now() + 60_000 });
res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 503, "shared pool empty");
assert.equal((await res.json()).code, "ai_capacity_exhausted");
counters.set("tok:all", { hits: 0, reset_at: Date.now() + 60_000 });

// Requests per minute: 20, counted including the ones above.
counters.set("req:11111111-1111-4111-8111-111111111111", { hits: 20, reset_at: Date.now() + 60_000 });
res = await call("POST", "/api/ai/generate", { token: "good", body: ask });
assert.equal(res.status, 429, "21st request in a minute refused");

// Allowlist.
res = await worker.fetch(
  new Request("https://api.test/api/ai/generate", {
    method: "POST",
    headers: { Authorization: "Bearer good", "Content-Type": "application/json" },
    body: JSON.stringify(ask),
  }),
  { ...env, ALLOWED_EMAILS: "someone@else.dev" },
  ctx,
);
assert.equal(res.status, 403, "not on ALLOWED_EMAILS");

console.log("worker: ok");
