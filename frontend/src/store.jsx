import { createContext, useContext, useEffect, useRef, useReducer, useState } from 'react'
import { readScoped, writeScoped } from './lib/scopedStorage.js'
import { useSession } from './auth/useSession.js'
import { pull, push, subscribe, reconcile, readRev } from './lib/cloudSync.js'

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
// Spending used to be stored on its own, outside this state object, so it
// never reached the cloud. loadState() folds it in once; see EXPENSES_KEY below.
const EXPENSES_KEY = 'student-os-expenses'

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
  tasks: [],          // { id, text, done, due, priority, courseId? }
  courses: [],        // { id, name, color } — subjects tasks and events belong to
  events: [],         // { id, date, time, title }              — one-off things
  scheduleBlocks: [], // { id, day, startHour, endHour, title } — weekly routine
  alarms: [],         // { id, at, label, fired }               — `at` is a timestamp
  expenses: [],       // { id, amount, category, date, note }   — see finance/useExpenses.ts
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

    // ── Courses ──
    case 'add-course':
      return {
        ...state,
        courses: [...state.courses, { id: newId(), ...action.course }],
      }

    case 'update-course':
      return {
        ...state,
        courses: state.courses.map(c =>
          c.id === action.id ? { ...c, ...action.changes } : c,
        ),
      }

    // Dropping a course must not leave its tasks pointing at something that no
    // longer exists — they'd render with a blank chip and break any lookup.
    // The tasks themselves survive; they just stop belonging to a subject.
    case 'delete-course':
      return {
        ...state,
        courses: state.courses.filter(c => c.id !== action.id),
        tasks: state.tasks.map(t =>
          t.courseId === action.id ? { ...t, courseId: undefined } : t,
        ),
      }

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

    case 'add-expense':
      return { ...state, expenses: [...state.expenses, { id: newId(), ...action.expense }] }

    case 'delete-expense':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) }

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

    // Spending predates living in this object. Adopt the separate key once;
    // from then on the `expenses` above is the only copy.
    if (!Array.isArray(loaded.expenses) || loaded.expenses.length === 0) {
      const legacyExpenses = readScoped(EXPENSES_KEY, userId)
      if (legacyExpenses) {
        const parsed = JSON.parse(legacyExpenses)
        if (Array.isArray(parsed)) loaded.expenses = parsed
      }
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

// ─── Cloud sync ──────────────────────────────────────────────────────────────
// localStorage stays the working copy; this mirrors it to the account's row so
// the same data shows up on every device. See lib/cloudSync.js.
//
// How long to sit on an edit before sending it. Long enough that typing a task
// title is one write instead of thirty, short enough to feel immediate.
const PUSH_DEBOUNCE_MS = 1200

function useCloudSync(state, dispatch, userId) {
  // What the user is told about their data. A failed save used to be entirely
  // silent — you would keep working, believing it was safe, and find out on
  // the next device. 'local' is not an error: the app works offline by design,
  // it just has to say so.
  const [status, setStatus] = useState('idle')
  // The newest state, readable from a timer without making the timer depend on
  // every keystroke.
  const latest = useRef(state)
  latest.current = state

  // Until the first pull has settled we must not push: an empty local state
  // would otherwise overwrite a perfectly good row on the server.
  const ready = useRef(false)
  const pending = useRef(false)

  useEffect(() => {
    ready.current = false
    if (!userId) return

    let cancelled = false

    const adopt = remoteData => {
      // Theme and ownership belong to this device, not to the row.
      dispatch({
        type: 'load-user',
        value: { ...emptyState, ...remoteData, theme: latest.current.theme, ownerId: userId },
      })
    }

    const flush = async () => {
      if (!ready.current || !pending.current) return
      pending.current = false
      setStatus('saving')
      const rev = await push(userId, latest.current)
      // The write failed — keep it pending so the next tick or reconnect retries.
      if (rev === null) {
        pending.current = true
        setStatus('local')
        return
      }
      setStatus('synced')
    }

    ;(async () => {
      const remote = await pull(userId)
      if (cancelled) return

      const localRev = readRev(userId)
      const hasLocalData =
        latest.current.tasks.length > 0 ||
        latest.current.events.length > 0 ||
        latest.current.scheduleBlocks.length > 0 ||
        latest.current.alarms.length > 0 ||
        latest.current.courses.length > 0 ||
        latest.current.expenses.length > 0

      const { action } = reconcile({ remote, localRev, hasLocalData })
      if (action === 'adopt') adopt(remote.data)
      ready.current = action !== 'wait'
      // Couldn't reach the server at all: everything still works, on this
      // device only, and the next successful flush clears this.
      if (action === 'wait') setStatus('local')
      if (action === 'push') pending.current = true
      await flush()
    })()

    const stop = subscribe(userId, adopt)
    const timer = setInterval(flush, PUSH_DEBOUNCE_MS)
    // Coming back from a tunnel or campus wifi: retry whatever is still queued.
    const onOnline = () => { flush() }
    window.addEventListener('online', onOnline)
    // A tab closing mid-debounce would otherwise drop the last edit.
    window.addEventListener('pagehide', flush)

    return () => {
      cancelled = true
      stop()
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [userId, dispatch])

  // Any local change becomes something to send on the next tick.
  useEffect(() => {
    if (state.ownerId === userId) pending.current = true
  }, [state, userId])

  return status
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  // The account is the source of truth for the name, so it follows the user to
  // any device.
  const displayName = session?.user?.user_metadata?.name ?? ''

  // Swap the whole store when the signed-in account changes — including on
  // first load, where it starts as null and becomes a real id once the stored
  // session has been read back.
  //
  // The name is applied here rather than by a separate effect. A child effect
  // that dispatched `set-name` would run BEFORE this one (React runs child
  // effects first), so this swap would overwrite it in the same batch — and
  // because profileName read the same before and after that sequence, the
  // child's dependencies looked unchanged and it never retried. The name was
  // silently lost.
  useEffect(() => {
    if (state.ownerId === userId) return
    const next = loadState(userId)
    if (displayName) next.profileName = displayName
    dispatch({ type: 'load-user', value: next })
  }, [userId, state.ownerId, displayName])

  // A later rename in Supabase still has to reach the store, and by now the
  // swap above has settled, so there is nothing to race with.
  useEffect(() => {
    if (displayName && displayName !== state.profileName && state.ownerId === userId) {
      dispatch({ type: 'set-name', value: displayName })
    }
  }, [displayName, state.profileName, state.ownerId, userId])

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

  const sync = useCloudSync(state, dispatch, userId)

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

  return (
    <StoreContext.Provider value={{ state, dispatch, sync }}>{children}</StoreContext.Provider>
  )
}

// Every component calls this to read state or change it.
export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
