# Student OS

A personal productivity PWA — tasks, calendar, weekly schedule, timers and
spending — with an AI assistant that can actually **operate the app**, not just
talk about it.

Installable, works offline, and your data stays on your own device.

<!-- Add a screenshot once you have one: save it as docs/screenshot.png
![Student OS](docs/screenshot.png)
-->

## Run it

```bash
npm install
npm start
```

That starts both halves — API on `:3001`, app on `:5173`. Open
http://localhost:5173.

You'll need a `.env` in each half first; see [Configuration](#configuration).

## What it does

| | |
|---|---|
| **Tasks** | Due dates, priorities, completion |
| **Calendar** | Month grid; tasks with a due date appear on their day |
| **Schedule** | Recurring weekly timetable, kept separate from one-off events |
| **Timers & alarms** | Stores target timestamps, so a background tab stays accurate |
| **Spending** | Monthly totals, category breakdown, 6-month trend |
| **Quick launch** | Drag-to-reorder shortcuts with auto-fetched favicons |
| **AI assistant** | Natural language in, real changes to your data out |

## The AI assistant

The interesting part. The model gets **7 tools** — `add_task`, `complete_task`,
`delete_task`, `add_event`, `add_schedule_block`, `set_alarm`, `start_timer` —
plus a compact summary of current state.

Say *"add a task to buy milk tomorrow"* and it emits a tool call. The app runs
that call by dispatching **the same reducer action the UI button dispatches**,
appends the result, and sends it back for a final sentence.

That's the whole design: the assistant has no privileged path into your data.
It cannot do anything you couldn't do by clicking. Adding a capability means
declaring one tool and pointing it at an action that already exists.

## Layout

```
student-os/
├── frontend/   React 19 + Vite PWA          → frontend/README.md
└── backend/    Express API (AI proxy, auth) → backend/README.md
```

One repo, two npm workspaces. They share **no code** — only HTTP. Each has its
own `package.json`, its own `.env`, and can be deployed independently.

### Why there's a backend at all

The AI provider key and privileged database access can't live in a browser. The
backend holds both: it verifies the Supabase session token, then makes the AI
call server-side. Sign-in itself happens client-side against Supabase Auth with
the public anon key.

**Without the backend running, only the assistant stops working.** Tasks,
calendar, schedule, timers and spending are entirely local.

## Architecture

One idea explains most of the frontend:

```
  state  ──React renders──>  UI
    ^                         |
    |                         | click, type, or an AI tool call
    └──── dispatch(action) ───┘
```

`frontend/src/store.jsx` holds every piece of app data in a single object behind
one `useReducer`. Nothing mutates it directly — every change goes through a
named action. A new feature costs three predictable edits: a field in state, a
case in the reducer, a component.

Data persists to `localStorage`, namespaced per account (`<key>:<user-id>`), so
two people signing in on the same browser never see each other's data.

## Configuration

**`frontend/.env`**

| Variable | |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / publishable** |
| `VITE_API_URL` | Backend URL (default `http://localhost:3001`) |

**`backend/.env`**

| Variable | |
|---|---|
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | API Keys → **service_role**. Secret. Bypasses RLS. |
| `AI_API_KEY` | Any OpenAI-compatible provider (e.g. console.groq.com) |
| `AI_BASE_URL` / `AI_MODEL` | Endpoint and model name |
| `FRONTEND_URL` | Allowed CORS origin |
| `ALLOWED_EMAILS` | Optional allowlist for the AI route |

Copy `.env.example` in each folder as a starting point. The **anon** key is
public by design and belongs in the frontend; the **service role** key belongs
only in the backend. They are not interchangeable — `npm run check` catches the
mix-up.

Backend setup, including the SQL for the table and its Row Level Security
policy, is in [backend/README.md](backend/README.md).

## Stack

React 19 · Vite 7 · vite-plugin-pwa · Express 5 · Supabase (Postgres + Auth) ·
Recharts · dnd-kit · Three.js / React Three Fiber

No Redux, no Tailwind, no date library, no UI kit, no router — deliberately. The
state container is ~60 lines of React, dates are `Intl` and string slicing, and
five tabs are one `useState`.

### The mascot

`frontend/src/components/mascot/` is a procedurally-built 3D octopus — no model
file, just primitives. Each arm is a recursive chain of five tapering segments,
so small per-joint rotations accumulate into a continuous curl, animated as a
travelling wave. Four idle states cycle without repeating, and it tracks
interactive elements under your cursor.

## Tests

```bash
npm test          # both workspaces
npm run check     # verifies backend Supabase setup
npm run smoke     # end-to-end: real user, real token, real AI round trip
```

The storage tests are the ones that matter: they cover the one-time migration of
pre-account data and assert that a second account inherits nothing.

## Status

Built and tested locally; not deployed. Data lives in `localStorage`, so it is
per-device and per-browser — there is no sync.

## License

MIT — see [LICENSE](LICENSE).
