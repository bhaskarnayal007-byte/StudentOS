# stratus-frontend

The Stratus PWA: React 19 + Vite 7. What the app does and how Octi works are
covered in the [root README](../README.md). This file is a map of this folder.

It is one of the two npm workspaces in this repo. From the root, `npm start`
runs it on `:5173` alongside the backend.

## Where things are

```
src/
├── main.jsx          entry: router, StoreProvider, ErrorBoundary
├── App.jsx           routes, the section list (SECTIONS), the app frame
├── store.jsx         THE state file: one useReducer holds all app data
├── dates.js          "YYYY-MM-DD" day keys and the helpers around them
├── theme.css         every style and every theme, as CSS custom properties
├── ai/
│   ├── agentLoop.js  Octi's loop: send to the backend, run tool calls, repeat
│   ├── tools.js      the 15 tool definitions, runTool(), the prompts
│   └── commands.js   regex fast path: "25 min timer" runs with no model at all
├── auth/useSession.js  the Supabase session
├── lib/              plain modules and hooks, one job each (cloudSync,
│                     reconcile, scopedStorage, fileStore, social, chat, useNow, …)
└── components/
    ├── <Name>Page.jsx  one per route: TasksPage, NotesPage, OctiPage, …
    ├── home/           Home and its widgets
    ├── finance/        the spending overlay at /money
    ├── mascot/         the 3D Octi
    ├── auth/           sign-in and sign-up
    ├── legal/          privacy and terms pages
    └── ui/TopoField.tsx  the animated background
scripts/
├── test-<moduleName>.mjs   plain node + assert tests, one per module
└── make-assets.mjs         regenerates the PWA icons
```

A new feature is usually three edits: a field in `emptyState` in `store.jsx`, a
reducer case, and a component. Giving Octi a new ability is one tool in
`ai/tools.js` that dispatches an action that already exists.

## Environment

Copy `.env.example` to `.env`:

| Variable | |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / publishable** |
| `VITE_API_URL` | Where the backend runs (default `http://localhost:3001`) |

The anon key is public by design: it ships to the browser and Row Level
Security constrains it. The service-role key never goes here.

## Commands

```bash
npm run dev       # dev server on :5173
npm run build     # production build into dist/
npm run preview   # serve dist/
npm test          # every scripts/test-*.mjs
node scripts/make-assets.mjs   # rebuild icons from src/assets/*.png into public/
```

## Notes

- `public/_headers` holds the security headers and the CSP for Cloudflare Pages,
  which serves `index.html` for the app's routes on its own.
- Local data lives in `localStorage` under per-account keys, still named
  `student-os-*` from before the rename (see the comment in `store.jsx`). Note
  attachments live in IndexedDB.
