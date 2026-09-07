import "dotenv/config";

// Diagnoses a Supabase setup. Every check prints why it failed and what to do,
// so a broken .env gives you a sentence instead of a stack trace.

let failed = false;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, fix) => { failed = true; console.log(`  FAIL  ${m}\n        -> ${fix}`); };

console.log("\nSupabase setup check\n");

// ── 1. URL ──────────────────────────────────────────────────────────────────
const url = process.env.SUPABASE_URL;
if (!url) {
  bad("SUPABASE_URL is not set", "Copy .env.example to .env and fill it in.");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  bad(
    `SUPABASE_URL looks wrong: ${url}`,
    "It must be just the project URL - https://<ref>.supabase.co - with no path, no trailing /rest/v1."
  );
} else {
  ok("SUPABASE_URL");
}

// ── 2. Key: present, and the RIGHT one ──────────────────────────────────────
// Mixing up anon and service_role is the most common setup failure, and the
// symptom is confusing: requests succeed but silently return zero rows,
// because RLS filters everything out instead of erroring.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function roleOf(k) {
  if (k.startsWith("sb_secret_")) return "service_role";
  if (k.startsWith("sb_publishable_")) return "anon";
  try {
    // Legacy keys are JWTs; the payload carries a `role` claim.
    return JSON.parse(Buffer.from(k.split(".")[1], "base64").toString()).role;
  } catch {
    return null;
  }
}

if (!key) {
  bad("SUPABASE_SERVICE_ROLE_KEY is not set", "Project Settings -> API Keys -> service_role (or 'secret').");
} else {
  const role = roleOf(key);
  if (role === "service_role") ok("SUPABASE_SERVICE_ROLE_KEY (service_role)");
  else if (role === "anon") {
    bad(
      "That is the ANON key, not the service role key",
      "The anon key is the public one for the frontend. This server needs the secret one: Project Settings -> API Keys -> service_role / 'secret'. Click Reveal."
    );
  } else {
    bad(
      "SUPABASE_SERVICE_ROLE_KEY is not a recognisable Supabase key",
      "Re-copy it - a partial paste or a wrapped line will do this."
    );
  }
}

if (failed) {
  console.log("\nFix the above, then run this again.\n");
  process.exit(1);
}

// ── 3. Does it actually work? ───────────────────────────────────────────────
const { supabase } = await import("../src/lib/supabase.js");

// listUsers is service-role-only, so it proves the key has real privilege
// rather than merely being well-formed.
const { error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
if (authErr) {
  bad(`Supabase rejected the key: ${authErr.message}`, "Re-copy the service_role key; check the project isn't paused.");
} else {
  ok("connected, key has service_role privileges");
}

// ── 4. The table ────────────────────────────────────────────────────────────
const table = process.env.DATA_TABLE ?? "items";
const { error: tableErr } = await supabase.from(table).select("id").limit(1);

if (tableErr) {
  // 42P01 is Postgres' "undefined table"; PGRST205 is PostgREST's version of
  // the same thing, and is what you actually get through the REST API.
  if (tableErr.code === "42P01" || tableErr.code === "PGRST205") {
    bad(`Table "${table}" does not exist`, "Run the SQL in README.md (Database -> SQL Editor), or set DATA_TABLE to your table.");
  } else {
    bad(`Querying "${table}" failed: ${tableErr.message}`, "Check the table name and its columns.");
  }
} else {
  ok(`table "${table}" is readable`);
}

console.log(failed ? "\nSome checks failed.\n" : "\nAll good. Start the server with: npm run dev\n");
process.exit(failed ? 1 : 0);
