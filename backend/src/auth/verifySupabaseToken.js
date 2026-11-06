// Checks the `Authorization: Bearer <token>` header against Supabase and
// returns the user it belongs to.
import { HttpError } from "../http/jsonResponse.js";

/**
 * Asks Supabase to validate rather than decoding the JWT locally: local
 * verification only proves the signature and expiry, so a token from a user
 * who has since signed out or been deleted would still pass. One network
 * round trip, and correct.
 */
export default async function verifySupabaseToken(request, supabase) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) throw new HttpError(401, "Missing bearer token");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Invalid or expired token");
  return data.user;
}

/**
 * Optional allowlist on top of a valid token. Supabase sign-up is open, so
 * without ALLOWED_EMAILS anyone who finds the app can spend the AI quota.
 * Unset, it lets everyone through, which is right for local development.
 */
export function requireAllowedUser(user, env) {
  const allowed = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return;
  if (user.email && allowed.includes(user.email.toLowerCase())) return;
  // 403, not 401: the token is fine, the account just isn't permitted.
  throw new HttpError(403, "This account is not allowed to use the assistant.");
}
