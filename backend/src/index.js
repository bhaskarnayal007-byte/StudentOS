// The Cloudflare Worker: Stratus's backend. Holds the two things the app
// mustn't, the AI provider keys and the Supabase service-role key.
// Config is in ../wrangler.toml; secrets are set with `wrangler secret put`.
import { createClient } from "@supabase/supabase-js";
import { HttpError, corsHeaders, errorResponse, json, withHeaders } from "./http/jsonResponse.js";
import { deleteMe, getMe } from "./routes/authMe.js";
import { generate } from "./routes/aiGenerate.js";

// Same cap Express had on request bodies. Octi sends the app state with every
// call, which is the only thing that gets large.
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Supabase with the SERVICE ROLE key, which bypasses Row Level Security, so
 * every query made with it must filter by the verified user's id itself.
 * `fetch` is passed through so it always uses the Worker's (and the tests').
 */
function supabaseAdmin(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (wrangler secret put).");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (...args) => fetch(...args) },
  });
}

async function route(request, env, ctx) {
  const { pathname } = new URL(request.url);
  const key = `${request.method} ${pathname.replace(/\/+$/, "") || "/"}`;

  // Before anything touches Supabase, so it still answers if Supabase is down.
  if (key === "GET /health") return json(200, { ok: true });

  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    throw new HttpError(413, "Request body too large");
  }

  switch (key) {
    case "GET /api/auth/me":
      return getMe(request, supabaseAdmin(env));
    case "DELETE /api/auth/me":
      return deleteMe(request, supabaseAdmin(env));
    case "POST /api/ai/generate":
      return generate(request, env, ctx, supabaseAdmin(env));
    default:
      return json(404, { error: "Not found" });
  }
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return withHeaders(new Response(null, { status: 204 }), cors);

    let response;
    try {
      response = await route(request, env, ctx);
    } catch (err) {
      response = errorResponse(err);
    }
    return withHeaders(response, cors);
  },
};
