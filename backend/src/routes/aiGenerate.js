// POST /api/ai/generate: Octi's model call, made here so the provider keys
// never reach the app. Port of the Express routes/ai.js.
import verifySupabaseToken, { requireAllowedUser } from "../auth/verifySupabaseToken.js";
import { HttpError, json } from "../http/jsonResponse.js";
import { checkRequestLimit, checkTokenBudget, spendTokens } from "../http/rateLimitPerUser.js";

/**
 * AI_PROVIDERS is a comma-separated list of `name|baseUrl|model|KEY_VAR`
 * entries, tried in order. All are OpenAI-compatible, so adding one is a
 * config change. Free tiers are metered per model, so two models on one key
 * are two separate daily pools: order by headroom, roomiest first. Entries
 * whose key isn't set are skipped.
 */
function providers(env) {
  const fallback = `groq|${env.AI_BASE_URL ?? "https://api.groq.com/openai/v1"}|${env.AI_MODEL ?? "openai/gpt-oss-120b"}|AI_API_KEY`;
  return (env.AI_PROVIDERS || fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, baseUrl, model, keyVar] = entry.split("|").map((s) => s.trim());
      // Trailing slash stripped: `${baseUrl}/chat/completions` would double it,
      // and some gateways 404 on that.
      return { name, baseUrl: (baseUrl ?? "").replace(/\/+$/, ""), model, key: env[keyVar ?? ""] };
    })
    .filter((p) => p.baseUrl && p.model && p.key);
}

// Four providers tried in series must still finish in reasonable time.
const TIMEOUT_MS = 12_000;

// The agent loop makes up to 8 calls per message, so this is about 5 Octi
// messages a minute: plenty for a person, too few for one user to eat the
// key's per-minute limit.
const REQUESTS_PER_MINUTE = 20;

/**
 * Users who synced in the last 7 days. Each user's daily share is the pool
 * split between them. Counted at most every 10 minutes per Worker instance;
 * a trailing week (not "today") stops the first user of the morning seeing a
 * count of 1 and taking the whole pool.
 */
let active = { count: 1, at: 0 };
async function activeUsers(supabase) {
  if (Date.now() - active.at < 10 * 60_000) return active.count;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const { count, error } = await supabase
    .from("user_state")
    .select("user_id", { count: "exact", head: true })
    .gte("updated_at", since);
  // On failure keep the last known count rather than resetting it.
  if (error) console.error("active user count failed:", error.message || error);
  else active = { count: Math.max(1, count ?? 1), at: Date.now() };
  return active.count;
}

export async function generate(request, env, ctx, supabase) {
  const user = await verifySupabaseToken(request, supabase);
  requireAllowedUser(user, env);

  // The whole pool, split evenly, but never below a floor: at 1000 users an
  // even split is less than one request. One message is ~10k tokens over two
  // rounds, so the 30k floor is about three. The total still caps everyone.
  const total = Number(env.AI_DAILY_TOKENS) || 600_000;
  const floor = Number(env.AI_MIN_USER_TOKENS) || 30_000;
  const perUser = Math.max(floor, Math.floor(total / (await activeUsers(supabase))));

  await checkRequestLimit(supabase, user.id, REQUESTS_PER_MINUTE);
  await checkTokenBudget(supabase, user.id, { perUser, total });

  // `model` is deliberately not read from the body: a caller could otherwise
  // pick the provider's most expensive model on our key.
  const { messages, tools, tool_choice, temperature } = await request.json().catch(() => ({}));
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, "`messages` must be a non-empty array");
  }

  const chain = providers(env);
  if (chain.length === 0) throw new HttpError(503, "AI provider is not configured");

  const body = {
    messages,
    ...(tools ? { tools } : {}),
    ...(tool_choice && tools ? { tool_choice } : {}),
    ...(temperature != null ? { temperature } : {}),
    // Never from the body, so a client can't raise it. 2048 leaves room for
    // gpt-oss's reasoning tokens, which count against it.
    max_tokens: Number(env.AI_MAX_REPLY_TOKENS) || 2048,
  };

  // A 429 means that model's pool is spent and the next entry has its own; a
  // 5xx, timeout or dead host means this provider is unwell. Anything else
  // (400, 401) would fail the same way everywhere, so it stops the chain.
  let failure = { status: 503, error: "AI provider request failed" };

  for (const provider of chain) {
    let upstream;
    try {
      upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({ model: provider.model, ...body }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
      failure = timedOut
        ? { status: 504, error: "AI provider timed out" }
        : { status: 502, error: "AI provider unreachable" };
      continue;
    }

    const payload = await upstream.json().catch(() => null);

    if (upstream.ok) {
      // After the reply is sent, so the user doesn't wait on the bookkeeping.
      ctx.waitUntil(
        spendTokens(supabase, user.id, payload?.usage?.total_tokens).catch((err) => console.error(err)),
      );
      // Which pool served this, visible in the app's network tab.
      return json(200, payload, { "X-AI-Provider": `${provider.name}:${provider.model}` });
    }

    // Pass the provider's status through so the app can tell a bad request
    // from a rate limit, but not its raw error body.
    failure = { status: upstream.status, error: payload?.error?.message ?? "AI provider request failed" };
    if (upstream.status !== 429 && upstream.status < 500) break;
  }

  return json(failure.status, { error: failure.error });
}
