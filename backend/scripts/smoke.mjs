import "dotenv/config";
import { supabase } from "../src/lib/supabase.js";

// End-to-end check against a running server: creates a throwaway user, gets a
// real token, exercises the protected routes, then deletes the user again
// through the app's own "Delete account" route.

const API = `http://localhost:${process.env.PORT || 3001}`;
const email = `smoke-${Date.now()}@example.com`;
const password = crypto.randomUUID();

let userId;
const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass, detail }) && console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);

console.log("\nEnd-to-end check\n");

try {
  const health = await fetch(`${API}/health`).then((r) => r.json());
  check("GET /health", health.ok === true);
} catch {
  console.log("  FAIL  server is not running -> start it with `npm run dev` in another terminal\n");
  process.exit(1);
}

// A token has to come from a real account, so make one.
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (createErr) {
  console.log(`  FAIL  could not create test user: ${createErr.message}\n`);
  process.exit(1);
}
userId = created.user.id;

const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
if (signInErr) {
  console.log(`  FAIL  could not sign in: ${signInErr.message}\n`);
  await supabase.auth.admin.deleteUser(userId);
  process.exit(1);
}
const token = session.session.access_token;
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// ── the actual assertions ───────────────────────────────────────────────────
// Every route but /health needs a real token. (App data no longer passes
// through this server: it syncs straight to Supabase under row-level security.)
const noToken = await fetch(`${API}/api/auth/me`);
check("rejects a request with no token", noToken.status === 401, `got ${noToken.status}`);

const badToken = await fetch(`${API}/api/auth/me`, { headers: { Authorization: "Bearer nonsense" } });
check("rejects a bad token", badToken.status === 401, `got ${badToken.status}`);

const aiNoToken = await fetch(`${API}/api/ai/generate`, { method: "POST" });
check("AI route rejects a request with no token", aiNoToken.status === 401, `got ${aiNoToken.status}`);

const me = await fetch(`${API}/api/auth/me`, { headers: auth });
const meBody = await me.json();
check("GET /api/auth/me returns this user", me.ok && meBody.id === userId);

if (process.env.AI_API_KEY) {
  const ai = await fetch(`${API}/api/ai/generate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ messages: [{ role: "user", content: "Reply with the single word: pong" }] }),
  });
  const aiBody = await ai.json();
  check("POST /api/ai/generate reaches the provider", ai.ok && !!aiBody.choices?.[0]?.message,
    ai.ok ? `-> "${aiBody.choices[0].message.content?.trim().slice(0, 40)}"` : JSON.stringify(aiBody).slice(0, 120));
} else {
  console.log("  skip  AI route (AI_API_KEY is not set)");
}

// "Delete account" in the app: the user removes themselves with their own token.
const del = await fetch(`${API}/api/auth/me`, { method: "DELETE", headers: auth });
const { data: after } = await supabase.auth.admin.getUserById(userId);
check("DELETE /api/auth/me deletes the account", del.status === 204 && !after?.user, `got ${del.status}`);
if (after?.user) await supabase.auth.admin.deleteUser(userId); // never leave a test user behind

const failures = results.filter((r) => !r.pass).length;
console.log(failures ? `\n${failures} failed.\n` : "\nAll passed. Test user deleted.\n");
process.exit(failures ? 1 : 0);
