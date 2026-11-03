# stratus-backend

The Express API behind Stratus. It holds the two things the browser shouldn't:
the AI provider keys and the Supabase service-role key. It verifies the user's
Supabase session token, then makes the AI call server-side.

> **Being replaced.** Phase 1 of the launch plan ports this server to a
> Cloudflare Worker (see `LAUNCH_PROGRESS.md` §5). Until then this is what runs,
> on Render (`render.yaml` at the repo root).

It is one of the two npm workspaces in this repo. From the root, `npm start`
runs it on `:3001` alongside the app.

## Files

| Path | What it does |
|---|---|
| `src/server.js` | Express app: helmet, CORS, JSON body, `/health`, the routes |
| `src/routes/auth.js` | `GET /api/auth/me` |
| `src/routes/ai.js` | `POST /api/ai/generate`: provider rotation, rate limit, daily token budget |
| `src/middleware/requireAuth.js` | Checks the `Authorization: Bearer <token>` against Supabase |
| `src/middleware/requireAllowedUser.js` | Optional `ALLOWED_EMAILS` allowlist |
| `src/middleware/rateLimit.js` | Per-user request limit and token budget, in memory |
| `src/middleware/errorHandler.js` | One JSON error shape |
| `src/lib/supabase.js` | Service-role Supabase client |
| `scripts/check-env.mjs` | `npm run check`: verifies the Supabase setup |
| `scripts/smoke.mjs` | `npm run smoke`: end-to-end with a throwaway user |
| `scripts/test-middleware.mjs` | `npm test` |
| `scripts/load/` | Load tests for `user_state` writes (see `LAUNCH.md`) |

## Routes

| Route | |
|---|---|
| `GET /health` | Unauthenticated liveness check |
| `GET /api/auth/me` | The user behind the bearer token |
| `POST /api/ai/generate` | `{ messages, tools?, tool_choice?, temperature? }` → the provider's response |

Everything under `/api` requires a valid Supabase access token. The client
cannot choose the model or `max_tokens`. Limits are 20 requests a minute per
user, plus the daily token budget below.

## Setup

```bash
cp .env.example .env   # then fill it in
npm run check          # says exactly what is wrong, if anything
```

`.env.example` documents every variable. The ones you must set:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role`. **Secret**: it bypasses Row Level Security. Server only. |
| `AI_API_KEY` | console.groq.com |
| `FRONTEND_URL` | Origin(s) allowed to call this API, comma-separated |

Optional: `AI_PROVIDERS` (the model rotation), `NVIDIA_API_KEY`,
`OPENROUTER_API_KEY`, `ALLOWED_EMAILS`, `AI_DAILY_TOKENS`,
`AI_MIN_USER_TOKENS`, `AI_MAX_REPLY_TOKENS`, `PORT`.

The database schema is `supabase/migrations/` at the repo root. Run the files in
order in the SQL Editor. This server reads only `user_state`, to count active
users for the AI budget.

### Which Supabase key is which

| Key | Dashboard label | Goes where |
|---|---|---|
| anon / publishable | `anon` or `sb_publishable_...` | The **frontend**. Public by design. |
| service role / secret | `service_role` or `sb_secret_...` | **This server only.** Bypasses RLS. |

Putting the anon key here doesn't error. Queries just return zero rows, because
RLS filters them out. `npm run check` catches it.

## Commands

```bash
npm run dev     # nodemon, restarts on src/ and .env changes
npm start       # plain node, what Render runs
npm test        # middleware checks
npm run check   # Supabase setup
npm run smoke   # with the server running: real user, real token, real AI round trip
```

## Known limits

- Rate limits and AI budgets live in memory, so they are correct only while there
  is a single instance.
- Render's free plan sleeps after ~15 idle minutes. `.github/workflows/keep-awake.yml`
  pings `/health` every 10 minutes to keep it up.
