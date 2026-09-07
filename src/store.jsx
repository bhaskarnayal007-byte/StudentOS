import { createContext, useContext, useEffect, useReducer } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// THE STATE FILE. Everything the app knows lives in one object, defined here.
// Read this file top to bottom and you understand the whole app.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'student-os-state'
// The app used to be called Day Deck. Anyone who used it already has their
// data under the old key, so we read it once and carry it over rather than
// silently starting them from an empty app. Safe to delete this line — and
// the migration in loadState — once nobody is on the old build.
const LEGACY_KEY = 'day-deck-state'

// Shown on first run so the sidebar is never empty. The user can delete any of
// them, and deleting all of them sticks — see the note in loadState().
function DEFAULT_SHORTCUTS() {
  return [
    { name: 'Docs', url: 'https://docs.google.com' },
    { name: 'Gmail', url: 'https://mail.google.com' },
    { name: 'Notion', url: 'https://notion.so' },
    { name: 'Duolingo', url: 'https://duolingo.com' },
  ].map((s, i) => ({ ...s, id: newId(), iconUrl: faviconFor(s.url), order: i }))
}

// Google's favicon service. It takes a domain and returns an icon — no CORS
// problem because it's loaded as an <img>, not fetched as data.
export function faviconFor(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
  } catch {
    return ''
  }
}

// Keeps `order` matching array position after any add/remove/reorder.
const renumber = list => list.map((s, i) => (s.order === i ? s : { ...s, order: i }))

// The shape of all your data. Adding a feature usually starts by adding a key here.
const emptyState = {
  tasks: [],          // { id, text, done, due, priority }
  events: [],         // { id, date, time, title }              — one-off things
  scheduleBlocks: [], // { id, day, startHour, endHour, title } — weekly routine
  alarms: [],         // { id, at, label, fired }               — `at` is a timestamp
  timer: null,        // { endsAt, label } or null
  apiKey: '',         // your Groq key, typed into Settings
  theme: 'system',    // 'system' | 'light' | 'dark' — drives data-theme
  // Captured on the onboarding screen.
  profileName: '',
  // PBKDF2 salt + derived hash for the local gate. The password itself is
  // never stored. See the warning at the top of components/auth/password.ts
  // about what this does and does not protect.
  passwordSalt: '',
  passwordHash: '',

  // Quick Launch. { id, name, url, iconUrl, order } — see DEFAULT_SHORTCUTS.
  // Stored in list order; `order` is kept in sync so a future server sync has
  // an explicit field to persist rather than relying on array position.
  shortcuts: DEFAULT_SHORTCUTS(),
}

// ─── The reducer ─────────────────────────────────────────────────────────────
// A reducer is just a function: (currentState, action) => newState.
// It is the ONLY place state is allowed to change. Every case returns a *new*
// object rather than editing the old one — that's how React knows to redraw.
function reducer(state, action) {
  switch (action.type) {
    case 'add-task':
      return { ...state, tasks: [...state.tasks, { id: newId(), done: false, ...action.task }] }

    case 'toggle-task':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.id ? { ...t, done: !t.done } : t)),
      }

    case 'delete-task':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) }

    case 'add-event':
      return { ...state, events: [...state.events, { id: newId(), ...action.event }] }

    case 'delete-event':
      return { ...state, events: state.events.filter(e => e.id !== action.id) }

    case 'add-block':
      return {
        ...state,
        scheduleBlocks: [...state.scheduleBlocks, { id: newId(), ...action.block }],
      }

    case 'delete-block':
      return { ...state, scheduleBlocks: state.scheduleBlocks.filter(b => b.id !== action.id) }

    // `at` is a timestamp (milliseconds). See the note in Timers.jsx.
    case 'add-alarm':
      return { ...state, alarms: [...state.alarms, { id: newId(), fired: false, ...action.alarm }] }

    case 'delete-alarm':
      return { ...state, alarms: state.alarms.filter(a => a.id !== action.id) }

    case 'fire-alarms':
      return {
        ...state,
        alarms: state.alarms.map(a => (action.ids.includes(a.id) ? { ...a, fired: true } : a)),
      }

    case 'start-timer':
      return { ...state, timer: { endsAt: action.endsAt, label: action.label } }

    case 'clear-timer':
      return { ...state, timer: null }

    // ── Quick Launch ──
    case 'add-shortcut':
      return {
        ...state,
        shortcuts: renumber([...state.shortcuts, { id: newId(), ...action.shortcut }]),
      }

    case 'update-shortcut':
      return {
        ...state,
        shortcuts: state.shortcuts.map(s =>
          s.id === action.id ? { ...s, ...action.changes } : s,
        ),
      }

    case 'delete-shortcut':
      return {
        ...state,
        shortcuts: renumber(state.shortcuts.filter(s => s.id !== action.id)),
      }

    // Drag-and-drop hands us the from/to positions; we move one item.
    case 'move-shortcut': {
      const next = [...state.shortcuts]
      const [moved] = next.splice(action.from, 1)
      next.splice(action.to, 0, moved)
      return { ...state, shortcuts: renumber(next) }
    }

    case 'set-name':
      return { ...state, profileName: action.value }

    case 'set-credentials':
      return {
        ...state,
        profileName: action.name,
        passwordSalt: action.salt,
        passwordHash: action.hash,
      }

    case 'set-theme':
      return { ...state, theme: action.value }

    case 'set-api-key':
      return { ...state, apiKey: action.value }

    default:
      // A typo in an action type should be loud, not silent.
      throw new Error(`Unknown action: ${action.type}`)
  }
}

export function newId() {
  return crypto.randomUUID()
}

// ─── Loading and saving ──────────────────────────────────────────────────────
function loadState() {
  try {
    // Fall back to the pre-rename key, but only when nothing is stored under
    // the new one — otherwise a stale Day Deck save would clobber real data.
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    // Spreading emptyState first means: if you add a new key later, old saved
    // data still loads instead of crashing with `undefined`.
    //
    // This is also what makes the default shortcuts behave correctly: a save
    // with no `shortcuts` key at all (first run, or an older save) inherits the
    // defaults, while a save containing `shortcuts: []` — the user deleted them
    // all — overrides the defaults and stays empty.
    return saved ? { ...emptyState, ...JSON.parse(saved) } : emptyState
  } catch {
    return emptyState
  }
}

// ─── Wiring it into React ────────────────────────────────────────────────────
// Context is React's way to make one value reachable from any component
// without passing it down through every layer in between.
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // Runs after every render where `state` changed → save to disk.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Put the choice on <html> as data-theme, which is what the CSS reads.
  // 'system' removes the attribute entirely so the prefers-color-scheme rule
  // in theme.css takes over — one source of truth, no JS media listener.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = state.theme
  }, [state.theme])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

// Every component calls this to read state or change it.
export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
