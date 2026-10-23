import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import requireAllowedUser from "../middleware/requireAllowedUser.js";
import rateLimit, { tokenBudget } from "../middleware/rateLimit.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

// Everything provider-specific lives in these three values. Any OpenAI-
// compatible provider (Groq, OpenAI, Together, OpenRouter, a local vLLM)
// is a .env change. A provider with a different wire format is the only
// case that needs code, and then it's just the fetch below.
// The trailing slash is stripped because `${BASE_URL}/chat/completions` on a
// URL that already ends in "/" produces a double slash, which some gateways
// 404 on.
const BASE_URL = (process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const DEFAULT_MODEL = process.env.AI_MODEL ?? "openai/gpt-oss-120b";
const TIMEOUT_MS = 30_000;

// The agent loop makes up to 4 calls per user message, so this is roughly
// 5 assistant messages a minute per user: plenty for a person, and low enough
// that one user can't eat the whole key's per-minute limit on their own.
const limiter = rateLimit({ windowMs: 60_000, max: 20 });

// Daily tokens per user = the key's daily quota split evenly across active
// users, so the share shrinks as people join and grows as they leave.
// "Active" = synced in the last 7 days. That comes from user_state.updated_at
// in the database rather than memory, so it survives the free tier's restarts,
// and a trailing week (not "today") stops the first user of the morning seeing
// a count of 1 and taking the whole quota before anyone else wakes up.
// Groq's free tier is ~100k/day for the 70b model.
const DAILY_TOKENS = Number(process.env.AI_DAILY_TOKENS) || 100_000;
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

const budget = tokenBudget({
  windowMs: 24 * 60 * 60_000,
  max: () => Math.floor(DAILY_TOKENS / activeUsers),
});

/**
 * POST /api/ai/generate
 *
 * Body: { messages: [{role, content}], tools?, tool_choice?, temperature? }
 *
 * The whole point of this route is that AI_API_KEY stays on the server. The
 * frontend used to hold it in localStorage, where any devtools user could
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
    if (!process.env.AI_API_KEY) {
      return res.status(503).json({ error: "AI provider is not configured" });
    }

    // Without a timeout a hung provider holds the socket until the platform
    // kills it, and on a free tier that is most of your concurrency.
    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        ...(tools ? { tools } : {}),
        // Was dropped here. Providers default to "auto" when tools are present,
        // so tool use still worked — but "none" and a forced tool had no effect.
        ...(tool_choice && tools ? { tool_choice } : {}),
        ...(temperature != null ? { temperature } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      // Pass the provider's status through so the client can tell a bad
      // request from a rate limit, but not its raw error body.
      return res.status(upstream.status).json({
        error: payload?.error?.message ?? "AI provider request failed",
      });
    }

    budget.spend(req.user.id, payload?.usage?.total_tokens);
    res.json(payload);
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "AI provider timed out" });
    }
    next(err);
  }
});

export default router;
