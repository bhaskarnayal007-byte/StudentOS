// Per-user request limit and daily AI token budget, counted in Supabase
// (bump_ai_counter, supabase/migrations/0007_ai_request_counters.sql) because
// a Worker keeps nothing between requests.
import { HttpError } from "./jsonResponse.js";

const DAY_SECONDS = 24 * 60 * 60;

/** Adds `amount` to a counter (0 just reads it) and returns { hits, resetAt }. */
async function bump(supabase, key, windowSeconds, amount) {
  const { data, error } = await supabase.rpc("bump_ai_counter", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_amount: amount,
  });
  if (error) throw new Error(`bump_ai_counter ${key}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { hits: Number(row.hits), resetAt: new Date(row.reset_at).getTime() };
}

const secondsUntil = (t) => Math.max(1, Math.ceil((t - Date.now()) / 1000));

/**
 * Throws 429 once a user passes `max` requests in a minute. The request is
 * counted before the check, so refused ones count too, which is what stops a
 * client that retries in a tight loop.
 */
export async function checkRequestLimit(supabase, userId, max) {
  const { hits, resetAt } = await bump(supabase, `req:${userId}`, 60, 1);
  if (hits <= max) return;
  const retry = secondsUntil(resetAt);
  throw new HttpError(429, `Too many requests. Try again in ${retry}s.`, { "Retry-After": String(retry) });
}

/**
 * Throws once the day's tokens are gone: 503 when the shared pool is empty
 * (nobody's fault, and it says so), 429 when this user has used their share.
 * Only checks; spendTokens records the real usage after the reply.
 */
export async function checkTokenBudget(supabase, userId, { perUser, total }) {
  const [all, mine] = await Promise.all([
    bump(supabase, "tok:all", DAY_SECONDS, 0),
    bump(supabase, `tok:${userId}`, DAY_SECONDS, 0),
  ]);

  if (all.hits >= total) {
    const retry = secondsUntil(all.resetAt);
    const err = new HttpError(
      503,
      `The assistant is out of capacity for today, for everyone. It resets in ${Math.ceil(retry / 3600)}h.`,
      { "Retry-After": String(retry) },
    );
    err.code = "ai_capacity_exhausted";
    throw err;
  }
  if (mine.hits >= perUser) {
    const retry = secondsUntil(mine.resetAt);
    throw new HttpError(429, `You've used today's AI allowance. It resets in ${Math.ceil(retry / 3600)}h.`, {
      "Retry-After": String(retry),
    });
  }
}

/** Records what the provider said the call cost, for this user and in total. */
export async function spendTokens(supabase, userId, tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  await Promise.all([
    bump(supabase, `tok:${userId}`, DAY_SECONDS, tokens),
    bump(supabase, "tok:all", DAY_SECONDS, tokens),
  ]);
}
