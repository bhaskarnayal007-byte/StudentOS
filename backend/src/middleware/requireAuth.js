import { supabase } from "../lib/supabase.js";

/**
 * Verifies the Supabase access token the frontend sends as `Authorization:
 * Bearer <token>` and puts the user on `req.user`.
 *
 * Asks Supabase to validate rather than decoding the JWT locally: local
 * verification only proves the signature and expiry, so a token from a user
 * who has since signed out or been deleted would still pass. This costs one
 * network round trip and is correct.
 */
export default async function requireAuth(req, res, next) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  next();
}
