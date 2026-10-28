import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import requireAllowedUser from "../middleware/requireAllowedUser.js";
import rateLimit, { tokenBudget } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

// Every provider-specific value lives in AI_PROVIDERS: a comma-separated list
// of `name|baseUrl|model|KEY_ENV_VAR` entries, tried in order. They are all
// OpenAI-compatible, so the request body below is identical for every one and
// adding a provider is a .env change. A provider with a different wire format
// is the only case that needs code.
//
// The list exists for quota, not redundancy. Free tiers are metered PER MODEL,
// so `groq|…|gpt-oss-120b` and `groq|…|gpt-oss-20b` on the same key are two
// separate 200k-token/day pools. Order by headroom: the roomiest first.
//
// Entries whose key env var is unset are dropped, so a deployment with only
// AI_API_KEY set behaves exactly as it did before this list existed.
const DEFAULT_PROVIDERS = [
  `groq|${process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1"}|${process.env.AI_MODEL ?? "openai/gpt-oss-120b"}|AI_API_KEY`,
].join(",");

const PROVIDERS = (process.env.AI_PROVIDERS || DEFAULT_PROVIDERS)
  .split(",")
  .map(entry => entry.trim())
  .filter(Boolean)
  .map(entry => {
    const [name, baseUrl, model, keyVar] = entry.split("|").map(s => s.trim());
    return {
      name,
      // The trailing slash is stripped because `${baseUrl}/chat/completions` on
      // a URL that already ends in "/" produces a double slash, which some
      // gateways 404 on.
      baseUrl: (baseUrl ?? "").replace(/\/+$/, ""),
      model,
      key: process.env[keyVar ?? ""],
    };
  })
  .filter(p => p.baseUrl && p.model && p.key);

// 12s, not 30s: four providers tried in series must still finish inside the
// platform's request window.
const TIMEOUT_MS = 12_000;

// The agent loop makes up to 8 calls per user message, so this is roughly
// 5 assistant messages a minute per user: plenty for a person, and low enough
// that one user can't eat the whole key's per-minute limit on their own.
const limiter = rateLimit({ windowMs: 60_000, max: 20 });

// Daily tokens per user = the key's daily quota split evenly across active
// users, so the share shrinks as people join and grows as they leave.
// "Active" = synced in the last 7 days. That comes from user_state.updated_at
// in the database rather than memory, so it survives the free tier's restarts,
// and a trailing week (not "today") stops the first user of the morning seeing
// a count of 1 and taking the whole quota before anyone else wakes up.
//
// Groq's free tier is 200k tokens/day PER MODEL, so the default is three
// dependable models' worth. Raise it when you add a model to AI_PROVIDERS,
// lower it when one is retired.
const DAILY_TOKENS = Number(process.env.AI_DAILY_TOKENS) || 600_000;
let activeUsers = 1;

async function refreshActiveUsers() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const { count, error } = await supabase
    .from("user_state")
    .select("user_id", { count: "exact", head: true })
    .gte("updated_at", since);
  // On failure keep the last known count rather than resetting it.
  if (error) return console.error("active user count failed:", error.message || error);
  if (count != null) activeUsers = Math.max(1, count);
}
refreshActiveUsers();
setInterval(refreshActiveUsers, 10 * 60_000).unref();

// The even split alone hit zero in practice: at 1000 active users it is 600
// tokens, less than one request, so everyone was refused. One round costs
// ~5,000 tokens (state ~2,600 + tool definitions ~1,400 + instructions and
// history ~400, plus the reply), and a typical message is two rounds (act,
// then confirm), so 30k is about three messages. `total` keeps that floor from
// overspending the key: once DAILY_TOKENS is gone it is gone for everyone.
const MIN_USER_TOKENS = Number(process.env.AI_MIN_USER_TOKENS) || 30_000;

const budget = tokenBudget({
  windowMs: 24 * 60 * 60_000,
  max: () => Math.floor(DAILY_TOKENS / activeUsers),
  floor: MIN_USER_TOKENS,
  total: DAILY_TOKENS,
});

// Providers default to the model's whole context for the reply, so one
// runaway (a reasoning model thinking at length, a generation that loops) could
// spend a user's day in a single call. Replies here are a sentence or a tool
// call; 2048 leaves room for gpt-oss's reasoning tokens, which count against it.
const MAX_REPLY_TOKENS = Number(process.env.AI_MAX_REPLY_TOKENS) || 2048;

/**
 * POST /api/ai/generate
 *
 * Body: { messages: [{role, content}], tools?, tool_choice?, temperature? }
 *
 * The whole point of this route is that the provider keys stay on the server.
 * The frontend used to hold one in localStorage, where any devtools user could
 * read it.
 */
router.post("/generate", requireAuth, requireAllowedUser, limiter, budget, async (req, res, next) => {
  try {
    // `model` is deliberately not read from the body: a caller could otherwise
    // pick the provider's most expensive model on your key.
    const { messages, tools, tool_choice, temperature } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "`messages` must be a non-empty array" });
    }
    if (PROVIDERS.length === 0) {
      return res.status(503).json({ error: "AI provider is not configured" });
    }

    const body = {
      messages,
      ...(tools ? { tools } : {}),
      // Was dropped here. Providers default to "auto" when tools are present,
      // so tool use still worked — but "none" and a forced tool had no effect.
      ...(tool_choice && tools ? { tool_choice } : {}),
      ...(temperature != null ? { temperature } : {}),
      // Never read from the body, so a client can't raise it. `max_tokens`
      // rather than `max_completion_tokens`: every OpenAI-compatible provider
      // in the rotation accepts it.
      max_tokens: MAX_REPLY_TOKENS,
    };

    // Try each provider in turn. A 429 means that model's pool is spent for the
    // day and the next entry has its own; a 5xx or timeout means this provider
    // is unwell. Anything else (400, 401) is our fault and would fail the same
    // way everywhere, so it stops the chain.
    let failure = { status: 503, error: "AI provider request failed" };

    for (const provider of PROVIDERS) {
      let upstream;
      try {
        // Without a timeout a hung provider holds the socket until the platform
        // kills it, and on a free tier that is most of your concurrency.
        upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.key}`,
          },
          body: JSON.stringify({ model: provider.model, ...body }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        // Every way a request can fail to produce a reply means this provider
        // is no use right now, so all of them fall through to the next entry.
        // Timeouts throw TimeoutError, but a refused connection, a dead host
        // or a DNS failure throws a plain `TypeError: fetch failed` — letting
        // that one propagate turned a single unreachable provider into a 500
        // for the whole request, with the healthy entries behind it untried.
        const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
        failure = timedOut
          ? { status: 504, error: "AI provider timed out" }
          : { status: 502, error: "AI provider unreachable" };
        continue;
      }

      const payload = await upstream.json().catch(() => null);

      if (upstream.ok) {
        budget.spend(req.user.id, payload?.usage?.total_tokens);
        // Which pool served this, so draining can be watched in the browser's
        // network tab without server logs.
        res.set("X-AI-Provider", `${provider.name}:${provider.model}`);
        return res.json(payload);
      }

      // Pass the provider's status through so the client can tell a bad
      // request from a rate limit, but not its raw error body.
      failure = {
        status: upstream.status,
        error: payload?.error?.message ?? "AI provider request failed",
      };

      if (upstream.status !== 429 && upstream.status < 500) break;
    }

    return res.status(failure.status).json({ error: failure.error });
  } catch (err) {
    next(err);
  }
});

export default router;
