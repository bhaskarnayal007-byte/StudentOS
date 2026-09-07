import { createContext, useContext, useEffect, useReducer } from 'react'
import { readScoped, writeScoped } from './lib/scopedStorage.js'
import { useSession } from './auth/useSession.js'

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
// Theme is a property of the device, not the account: it has to apply on the
// login screen, where nobody is signed in yet. So it's stored outside the
// per-user slice as well as in it.
const THEME_KEY = 'student-os-theme'

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
  theme: 'system',    // 'system' | 'light' | 'dark' — drives data-theme
  // Mirrored from the Supabase user's metadata on sign-in, so HomePage can
  // greet you without an async read. The account is the source of truth.
  profileName: '',
  // Which account this state belongs to (null = nobody signed in). Kept in the
  // state itself rather than a ref because the save effect needs to know
  // whether what it's holding matches the user it would write it under — see
  // the note on that effect.
  ownerId: null,

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

    case 'set-theme':
      return { ...state, theme: action.value }

    // Swap in a different account's data wholesale. The only action that
    // replaces state rather than editing it.
    case 'load-user':
      return action.value

    default:
      // A typo in an action type should be loud, not silent.
      throw new Error(`Unknown action: ${action.type}`)
  }
}

export function newId() {
  return crypto.randomUUID()
}

// ─── Loading and saving ──────────────────────────────────────────────────────
function loadState(userId = null) {
  try {
    const deviceTheme = localStorage.getItem(THEME_KEY)

    // This account's own slice, falling back to the pre-account keys — the
    // unscoped one, then the pre-rename Day Deck one — which readScoped adopts
    // and clears on the first signed-in load.
    const saved = readScoped(STORAGE_KEY, userId, [LEGACY_KEY])
    if (!saved) {
      return { ...emptyState, ownerId: userId, theme: deviceTheme ?? emptyState.theme }
    }

    // Spreading emptyState first means: if you add a new key later, old saved
    // data still loads instead of crashing with `undefined`.
    //
    // This is also what makes the default shortcuts behave correctly: a save
    // with no `shortcuts` key at all (first run, or an older save) inherits the
    // defaults, while a save containing `shortcuts: []` — the user deleted them
    // all — overrides the defaults and stays empty.
    const loaded = { ...emptyState, ...JSON.parse(saved) }

    // That same spread also resurrects keys we've since removed, so a field
    // deleted from emptyState lives on in every existing save. It matters here
    // because one of them held a real API key: dropping the field from the code
    // did not drop it from anyone's disk. Deleting them on load does, since the
    // next save writes the pruned object back.
    for (const stale of ['apiKey', 'passwordSalt', 'passwordHash']) {
      delete loaded[stale]
    }

    loaded.ownerId = userId
    // A slice saved before themes were device-level has no theme of its own.
    if (deviceTheme && !JSON.parse(saved).theme) loaded.theme = deviceTheme

    return loaded
  } catch {
    return { ...emptyState, ownerId: userId }
  }
}

// ─── Wiring it into React ────────────────────────────────────────────────────
// Context is React's way to make one value reachable from any component
// without passing it down through every layer in between.
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const { session } = useSession()
  const userId = session?.user?.id ?? null

  // Swap the whole store when the signed-in account changes — including on
  // first load, where it starts as null and becomes a real id once the stored
  // session has been read back.
  useEffect(() => {
    if (state.ownerId === userId) return
    dispatch({ type: 'load-user', value: loadState(userId) })
  }, [userId, state.ownerId])

  // Runs after every render where `state` changed → save to disk.
  useEffect(() => {
    // Only write state that belongs to the account we'd be writing it under.
    // Both effects run in the same commit when the user changes, and this one
    // would otherwise persist the *previous* account's data under the *new*
    // account's key before the swap above has landed.
    // Signed out there is nothing worth saving, and writing would recreate the
    // unscoped key that readScoped just retired — handing the next account to
    // sign in on this browser a copy of someone else's data.
    if (!userId || state.ownerId !== userId) return
    writeScoped(STORAGE_KEY, userId, JSON.stringify(state))
  }, [state, userId])

  // Put the choice on <html> as data-theme, which is what the CSS reads.
  // 'system' removes the attribute entirely so the prefers-color-scheme rule
  // in theme.css takes over — one source of truth, no JS media listener.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = state.theme

    // Also kept outside the per-user slice, so the login screen — where there
    // is no user — still renders in the theme this device chose.
    try {
      localStorage.setItem(THEME_KEY, state.theme)
    } catch { /* private mode */ }
  }, [state.theme])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

// Every component calls this to read state or change it.
export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
