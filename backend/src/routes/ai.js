import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import requireAllowedUser from "../middleware/requireAllowedUser.js";
import rateLimit from "../middleware/rateLimit.js";

const router = Router();

// Everything provider-specific lives in these three values. Any OpenAI-
// compatible provider (Groq, OpenAI, Together, OpenRouter, a local vLLM)
// is a .env change. A provider with a different wire format is the only
// case that needs code, and then it's just the fetch below.
// The trailing slash is stripped because `${BASE_URL}/chat/completions` on a
// URL that already ends in "/" produces a double slash, which some gateways
// 404 on.
const BASE_URL = (process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const DEFAULT_MODEL = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
const TIMEOUT_MS = 30_000;

// The agent loop makes up to 4 calls per user message, so this is roughly
// 15 assistant messages a minute - far above normal use, well below a bill.
const limiter = rateLimit({ windowMs: 60_000, max: 60 });

/**
 * POST /api/ai/generate
 *
 * Body: { messages: [{role, content}], model?, tools?, tool_choice?, temperature? }
 *
 * The whole point of this route is that AI_API_KEY stays on the server. The
 * frontend used to hold it in localStorage, where any devtools user could
 * read it.
 */
router.post("/generate", requireAuth, requireAllowedUser, limiter, async (req, res, next) => {
  try {
    const { messages, model, tools, tool_choice, temperature } = req.body ?? {};

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
        model: model ?? DEFAULT_MODEL,
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

    res.json(payload);
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "AI provider timed out" });
    }
    next(err);
  }
});

export default router;
