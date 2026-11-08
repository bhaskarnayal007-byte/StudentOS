// Service-role Supabase client for the check and smoke scripts, which run in
// Node with backend/.env loaded (`node --env-file=.env`). The Worker makes its
// own in src/index.js.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fail up front: a missing key otherwise surfaces later as a confusing error
// from deep inside the SDK.
if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Copy .env.example to .env."
  );
}

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * This key bypasses Row Level Security, so this module must never reach a
 * browser. Because RLS is off for this client, every query MUST filter by
 * the user id itself. That filtering is the only thing
 * keeping one user's rows away from another.
 *
 * `persistSession: false` because a script has no logged-in user to
 * remember.
 */
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
