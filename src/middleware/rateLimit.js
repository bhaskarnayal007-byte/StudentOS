/**
 * Per-user fixed-window rate limit, in memory.
 *
 * The AI route spends real money and Supabase sign-up is open by default, so
 * without this anyone who finds the deployed URL can register an account and
 * drain the key. Auth alone does not protect a paid endpoint.
 *
 * ponytail: in-memory, so the count resets on restart and each instance keeps
 * its own tally. Fine on a single free-tier dyno; move to Postgres or Redis if
 * this ever runs more than one instance.
 */
export default function rateLimit({ windowMs, max }) {
  const hits = new Map(); // userId -> { count, resetAt }

  return function limiter(req, res, next) {
    const now = Date.now();
    const key = req.user?.id ?? req.ip;
    const entry = hits.get(key);

    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });

      // Drop expired entries so a long-running process doesn't grow forever.
      // Cheap because it only runs when a window rolls over.
      if (hits.size > 1000) {
        for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
      }
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter}s.`,
      });
    }

    entry.count += 1;
    next();
  };
}
