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

/**
 * Per-user token budget over a window, in memory. A request limit alone lets
 * one heavy user burn the whole provider quota with long prompts; this caps
 * what each user actually consumes so everyone gets a fair share.
 *
 * The middleware only checks; the route calls `budget.spend(userId, tokens)`
 * with the provider's reported usage once the reply is back. So the request
 * that crosses the line still completes, and the next one is refused.
 *
 * `max` may be a function, read on every check, so the allowance can follow
 * something that changes (like the number of active users).
 *
 * ponytail: in-memory like rateLimit above, same single-instance ceiling.
 */
export function tokenBudget({ windowMs, max }) {
  const limit = typeof max === "function" ? max : () => max;
  const used = new Map(); // userId -> { tokens, resetAt }

  const current = (key, now) => {
    let entry = used.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { tokens: 0, resetAt: now + windowMs };
      used.set(key, entry);
      if (used.size > 1000) {
        for (const [k, v] of used) if (now >= v.resetAt) used.delete(k);
      }
    }
    return entry;
  };

  function budget(req, res, next) {
    const now = Date.now();
    const entry = current(req.user?.id ?? req.ip, now);
    if (entry.tokens < limit()) return next();

    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: `You've used today's AI allowance. It resets in ${Math.ceil(retryAfter / 3600)}h.`,
    });
  }

  budget.spend = (key, tokens) => {
    if (Number.isFinite(tokens) && tokens > 0) current(key, Date.now()).tokens += tokens;
  };

  return budget;
}
