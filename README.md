# Student OS

A personal productivity PWA — tasks, calendar, weekly schedule, timers and
spending, with an AI assistant that can actually operate the app rather than
just talk about it.

Installable, works offline, and keeps your data on your own device.

<!-- Add a screenshot here once you have one:
     save it as docs/screenshot.png and uncomment the line below.
![Student OS](docs/screenshot.png)
-->

## What it does

| | |
|---|---|
| **Tasks** | Due dates, priorities, completion |
| **Calendar** | Month grid; tasks with a due date appear on their day |
| **Schedule** | Recurring weekly timetable, kept separate from one-off events |
| **Timers & alarms** | Stores target timestamps, so a background tab stays accurate |
| **Spending** | Monthly totals, category breakdown, 6-month trend |
| **Quick launch** | Drag-to-reorder app shortcuts with auto-fetched favicons |
| **AI assistant** | Natural language in, real changes to your data out |

## The AI assistant

The interesting part. The model is given **7 tools** — `add_task`,
`complete_task`, `delete_task`, `add_event`, `add_schedule_block`, `set_alarm`,
`start_timer` — and a compact summary of current state.

Ask it *"add a task to buy milk tomorrow"* and it emits a tool call. The app
runs that call by dispatching **the same reducer action the UI button
dispatches**, appends the result, and sends it back for a final sentence.

That's the whole design: the assistant has no privileged path into your data.
It can't do anything you couldn't do by clicking. Adding a new capability means
declaring one tool and pointing it at an action that already exists.

## Architecture

One idea explains most of the codebase:

```
  state  ──React renders──>  UI
    ^                         |
    |                         | click, type, or an AI tool call
    └──── dispatch(action) ───┘
```

`src/store.jsx` holds every piece of app data in a single object behind one
`useReducer`. Nothing mutates it directly — every change goes through a named
action. That's why a feature typically costs three predictable edits: a field in
state, a case in the reducer, a component.

Data persists to `localStorage`, namespaced per account (`<key>:<user-id>`) so
two people signing in on the same browser never see each other's data.

### Why there's a backend

The Groq API key and privileged database access can't live in a browser. The
companion repo, **`student-os-backend`**, is a small Express server that holds
both: it verifies the Supabase session token, then proxies the AI call
server-side. Sign-in itself happens client-side against Supabase Auth using the
public anon key.

<!-- After pushing, link the backend repo here:
     [student-os-backend](https://github.com/<you>/student-os-backend) -->

**Without the backend running, the assistant is the only thing that stops
working.** Tasks, calendar, schedule, timers and spending are entirely local.

## Stack

React 19 · Vite 7 · vite-plugin-pwa · Supabase Auth · Recharts · dnd-kit ·
Three.js / React Three Fiber · plain CSS with custom properties

No Redux, no Tailwind, no date library, no UI kit, no router — deliberately.
The state container is ~60 lines of React, dates are `Intl` and string slicing,
and five tabs are one `useState`.

### The mascot

`src/components/mascot/` is a procedurally-built 3D octopus: no model file, just
primitives. Each arm is a recursive chain of five tapering segments, so
small per-joint rotations accumulate into a continuous curl, animated as a
travelling wave. Four idle states cycle without repeating, and it tracks
interactive elements under your cursor.

## Running it

Needs **Node 20+** and both repos. The backend must be running for the
assistant to work; everything else works without it.

```bash
# 1. backend (separate repo — see its README for Supabase setup)
cd ../student-os-backend
npm install
npm run dev

# 2. this app
npm install
cp .env.example .env     # then fill it in
npm run dev
```

Open http://localhost:5173.

### Environment

| Variable | |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / publishable** |
| `VITE_API_URL` | Where the backend runs (default `http://localhost:3001`) |

The anon key is public by design — it ships to the browser and is constrained by
Row Level Security. The **service role** key is a different key entirely and
belongs only in the backend's `.env`.

## Tests

```bash
npm test        # per-account storage isolation and migration
npx tsc --noEmit
npm run build
```

The storage tests are the ones that matter: they cover the one-time migration of
pre-account data and assert that a second account inherits nothing.

## Regenerating icons

```bash
node scripts/make-assets.mjs
```

Keys the background out of `src/assets/*.png` and writes the PWA icon set into
`public/`. Those two source images are the only large files in the repo.

## Status

Built and tested locally; not deployed. Data lives in `localStorage`, so it is
per-device and per-browser — there is no sync.

## License

MIT — see [LICENSE](LICENSE).
