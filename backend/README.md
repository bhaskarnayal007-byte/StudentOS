# student-os-backend

Express API for the Student OS PWA. Holds two things the browser shouldn't:
the AI provider key, and privileged database access.

The frontend is a separate repo — **`student-os-frontend`** — and nothing is
shared between them but HTTP.

<!-- After pushing, link the frontend repo here:
     [student-os-frontend](https://github.com/<you>/student-os-frontend) -->

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role`. **Secret.** Bypasses Row Level Security. Server only — never put it in the frontend. |
| `AI_API_KEY` | Your provider's console (e.g. console.groq.com) |
| `AI_BASE_URL` / `AI_MODEL` | Any OpenAI-compatible endpoint + model name |
| `FRONTEND_URL` | Origin(s) allowed to call this API, comma-separated |
| `PORT` | Defaults to 3001 |

`.env` is gitignored. Keep it that way.

### Which key is which

Supabase gives you two keys and they are not interchangeable:

| Key | Dashboard label | Goes where |
|---|---|---|
| anon / publishable | `anon` or `sb_publishable_...` | The **frontend**. Public by design. |
| service role / secret | `service_role` or `sb_secret_...` (hidden behind *Reveal*) | **This server only.** Bypasses RLS. |

Putting the anon key here doesn't error — queries just return zero rows,
because RLS filters them all out. `npm run check` catches it.

### Create the table

Dashboard → SQL Editor → New query:

```sql
create table items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);

alter table items enable row level security;

create policy "own rows" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS matters even though this server bypasses it — the policy is what stops the
frontend's anon key from reading other people's rows.

## Verify the setup

```bash
npm run check
```

Checks the URL shape, that the key is the service-role one, that Supabase
accepts it, and that the table exists. Each failure says what to do.

With the server running, `npm run smoke` goes further: it creates a throwaway
user, gets a real token, and exercises every route — including that a bad token
is rejected and that a client-supplied `user_id` is ignored. It deletes the
test user afterwards.

If `grant`s are missing you'll see `permission denied for table` (a GRANT
problem, not RLS — RLS returns empty rows, never an error). Fix with:

```sql
grant all on table public.items to service_role, authenticated;
```

## Run

```bash
npm run dev
```

Check it: `curl http://localhost:3001/health` → `{"ok":true}`

## Routes

| Route | |
|---|---|
| `GET /health` | Unauthenticated liveness check |
| `GET /api/auth/me` | The user behind the bearer token |
| `POST /api/ai/generate` | `{ messages, model?, tools?, temperature? }` → provider response |
| `GET /api/data/items` | This user's rows |
| `POST /api/data/items` | Create a row for this user |

Everything under `/api` requires auth.

## How the frontend authenticates

Sign-up and sign-in happen **in the browser**, against Supabase Auth directly,
using the **anon** key. This server is not on the login path. It only ever
verifies tokens.

Then send the session's access token on every call:

```js
const { data: { session } } = await supabase.auth.getSession()

await fetch(`${API_URL}/api/ai/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ messages }),
})
```

`supabase-js` refreshes that token in the background, so read it from
`getSession()` at call time rather than caching it.

A 401 means the token expired or the user signed out — send them to the
login screen.

## Two things to know before you trust this

**The service role key ignores Row Level Security.** That's why it's here — the
server needs privileged access — but it means the `.eq('user_id', req.user.id)`
filter in `routes/data.js` is the *only* thing separating one user's rows from
another's. Every new query needs it. Still enable RLS on your tables: it
protects you from the frontend's anon key, which is a different threat.

**`DATA_TABLE` defaults to `items`.** Set it, or swap the table name, once you
have the real schema. The handlers reference no column but `user_id`.

## Deploying (Render free tier)

Build `npm install`, start `npm start`. Set every var from `.env.example` in the
dashboard, with `FRONTEND_URL` pointing at the deployed PWA. Free instances
sleep after inactivity, so the first request after idle takes ~30s — the AI
route's 30s timeout is upstream-only and unaffected, but the frontend should
tolerate a slow first call.
