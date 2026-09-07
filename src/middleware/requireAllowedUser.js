/**
 * Optional allowlist, on top of requireAuth.
 *
 * Supabase sign-up is open by default: anyone who reaches the deployed
 * frontend can create an account, and a valid account is all `requireAuth`
 * asks for. For a personal app that means strangers spending your AI quota.
 *
 * Set ALLOWED_EMAILS to a comma-separated list to close that. Left unset,
 * this is a no-op — which is the right default for local development.
 */
const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default function requireAllowedUser(req, res, next) {
  if (allowed.length === 0) return next();

  const email = req.user?.email?.toLowerCase();
  if (email && allowed.includes(email)) return next();

  // 403, not 401: the token is valid, the account just isn't permitted.
  // Re-authenticating would not help, and a 401 would tell the client to retry.
  return res.status(403).json({ error: "This account is not allowed to use the assistant." });
}
