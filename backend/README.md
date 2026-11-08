# stratus-backend

The Cloudflare Worker behind Stratus, live at
`https://stratus-api.bhaskarnayal007.workers.dev`. It holds the two things the
app shouldn't: the AI provider keys and the Supabase service-role key. It
verifies the user's Supabase session token, then makes the AI call
server-side.

It is one of the two npm workspaces in this repo. From the root, `npm start`
runs it on `:3001` alongside the app.

## Files

| Path | What it does |
|---|---|
| `wrangler.toml` | Worker config: name, non-secret vars, local dev port |
| `src/index.js` | Fetch entry point: CORS preflight, route table, error handling |
| `src/routes/authMe.js` | `GET` and `DELETE /api/auth/me` |
| `src/routes/aiGenerate.js` | `POST /api/ai/generate`: provider rotation, limits, daily token budget |
| `src/auth/verifySupabaseToken.js` | Checks the `Authorization: Bearer <token>` against Supabase; `ALLOWED_EMAILS` |
| `src/http/rateLimitPerUser.js` | Per-user request limit and token budget, counted in Supabase |
| `src/http/jsonResponse.js` | One JSON error shape, CORS, security headers |
| `scripts/test-worker.mjs` | `npm test`: the Worker end to end, Supabase and providers faked |
| `scripts/check-env.mjs` | `npm run check`: verifies the Supabase setup |
| `scripts/smoke.mjs` | `npm run smoke`: end-to-end against a running Worker with a throwaway user |
| `scripts/supabaseAdmin.mjs` | Service-role client for the two scripts above |
| `scripts/load/` | Load tests for `user_state` writes (see `LAUNCH.md`) |

## Routes

| Route | |
|---|---|
| `GET /health` | Unauthenticated liveness check |
| `GET /api/auth/me` | The user behind the bearer token |
| `DELETE /api/auth/me` | Deletes the caller's own account |
| `POST /api/ai/generate` | `{ messages, tools?, tool_choice?, temperature? }` → the provider's response |

Everything under `/api` requires a valid Supabase access token. The client
cannot choose the model or `max_tokens`. Limits are 20 requests a minute per
user, plus the daily token budget. Both are counted in the
`ai_request_counters` table (`bump_ai_counter`, migration
`0007_ai_request_counters.sql`), because a Worker keeps nothing in memory
between requests.

## Setup

Deployed values live in Cloudflare: the non-secret ones in `wrangler.toml`
`[vars]`, the secrets set once with `npx wrangler secret put NAME`
(`SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, and optionally `ALLOWED_EMAILS`,
`NVIDIA_API_KEY`, `OPENROUTER_API_KEY`).

For local work, `backend/.env` holds the same names; `npm run dev` reads it and
it overrides `[vars]`.

```bash
cp .env.example .env   # then fill it in
npm run check          # says exactly what is wrong, if anything
```

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` (Legacy tab) or a `sb_secret_...` key. **Secret**: it bypasses Row Level Security. |
| `AI_API_KEY` | console.groq.com |
| `FRONTEND_URL` | Origin(s) allowed to call this API, comma-separated. The Android app's `https://localhost` is always allowed. |

Optional: `AI_PROVIDERS` (the model rotation), `NVIDIA_API_KEY`,
`OPENROUTER_API_KEY`, `ALLOWED_EMAILS`, `AI_DAILY_TOKENS`,
`AI_MIN_USER_TOKENS`, `AI_MAX_REPLY_TOKENS`.

The database schema is `supabase/migrations/` at the repo root. Run the files in
order in the SQL Editor. The Worker reads `user_state` (to count active users
for the AI budget) and `ai_request_counters`.

### Which Supabase key is which

| Key | Dashboard label | Goes where |
|---|---|---|
| anon / publishable | `anon` or `sb_publishable_...` | The **frontend**. Public by design. |
| service role / secret | `service_role` or `sb_secret_...` | **This Worker only.** Bypasses RLS. |

Putting the anon key here doesn't error. Queries just return zero rows, because
RLS filters them out. `npm run check` catches it.

## Commands

```bash
npm run dev      # wrangler dev on :3001, reads .env
npm run deploy   # wrangler deploy to Cloudflare
npm test         # the Worker end to end, nothing real touched
npm run check    # Supabase setup
npm run smoke    # with `npm run dev` running: real user, real token, real AI round trip
```
