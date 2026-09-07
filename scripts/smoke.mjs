import "dotenv/config";
import { supabase } from "../src/lib/supabase.js";

// End-to-end check against a running server: creates a throwaway user, gets a
// real token, exercises the protected routes, then deletes the user again.
// The `items` row goes with it via `on delete cascade`.

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
const noToken = await fetch(`${API}/api/data/items`);
check("rejects a request with no token", noToken.status === 401, `got ${noToken.status}`);

const badToken = await fetch(`${API}/api/data/items`, { headers: { Authorization: "Bearer nonsense" } });
check("rejects a bad token", badToken.status === 401, `got ${badToken.status}`);

const me = await fetch(`${API}/api/auth/me`, { headers: auth });
const meBody = await me.json();
check("GET /api/auth/me returns this user", me.ok && meBody.id === userId);

const post = await fetch(`${API}/api/data/items`, {
  method: "POST", headers: auth, body: JSON.stringify({ title: "smoke test" }),
});
const posted = await post.json();
check("POST /api/data/items creates a row", post.status === 201 && posted.title === "smoke test",
  post.status === 201 ? "" : JSON.stringify(posted));

// The row must come back scoped to this user, with user_id set from the token.
const list = await fetch(`${API}/api/data/items`, { headers: auth });
const items = await list.json();
check("GET /api/data/items returns it", Array.isArray(items) && items.length === 1);
check("row is scoped to the caller", items[0]?.user_id === userId);

// A client must not be able to write a row onto someone else's account.
const spoof = await fetch(`${API}/api/data/items`, {
  method: "POST", headers: auth,
  body: JSON.stringify({ title: "spoofed", user_id: "00000000-0000-0000-0000-000000000000" }),
});
const spoofed = await spoof.json();
check("ignores a client-supplied user_id", spoofed.user_id === userId);

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

await supabase.auth.admin.deleteUser(userId);

const failures = results.filter((r) => !r.pass).length;
console.log(failures ? `\n${failures} failed.\n` : "\nAll passed. Test user deleted.\n");
process.exit(failures ? 1 : 0);
