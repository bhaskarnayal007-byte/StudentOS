import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Tasks from './components/Tasks.jsx'
import Calendar from './components/Calendar.jsx'
import Schedule from './components/Schedule.jsx'
import Timers, { AlarmWatcher } from './components/Timers.jsx'
import Assistant from './components/Assistant.jsx'
import AppLauncherSidebar from './components/AppLauncherSidebar.jsx'
import { useStore } from './store.jsx'
import AppBackground from './components/AppBackground.jsx'
import SpendingDashboard from './components/finance/SpendingDashboard'
import SpendingToggle from './components/finance/SpendingToggle'
import HomePage from './components/home/HomePage'
import LoginPage from './components/auth/LoginPage'
import PortalTransition from './components/PortalTransition'
import OctiDock from './components/OctiDock'
import { useSession, signOut } from './auth/useSession.js'

// One entry per section: the URL it lives at, the label in the nav, and the
// component that draws it. Adding a section later = one line here plus one
// new file. Home is first, so it's the landing view.
export const SECTIONS = [
  { path: '/', name: 'Home', Panel: HomePage },
  { path: '/tasks', name: 'Tasks', Panel: Tasks },
  { path: '/calendar', name: 'Calendar', Panel: Calendar },
  { path: '/schedule', name: 'Schedule', Panel: Schedule },
  { path: '/timers', name: 'Timers', Panel: Timers },
  { path: '/octi', name: 'Octi', Panel: Assistant },
]

// Callers still say onGoTo('Tasks') by name; this is how a name becomes a URL.
const PATH_BY_NAME = {
  ...Object.fromEntries(SECTIONS.map(s => [s.name, s.path])),
  // Octi used to be called the Assistant; callers still say the old name.
  Assistant: '/octi',
}

// Spending is a route too, so the back button closes it and the dashboard is
// linkable — but it renders as an overlay on top of whatever is behind it.
const FINANCE_PATH = '/money'

export default function App() {
  const { session, loading } = useSession()
  // Non-null only while the portal animation is running.
  const [seeds, setSeeds] = useState(null)

  // Everything shares one root so AppBackground mounts once and keeps running
  // across the login screen, the transition and the app — no restart, no flash.
  return (
    <div className="app">
      {/* Draws nothing; watches the clock so alarms ring on any route. */}
      <AlarmWatcher />

      {/* Fixed, full-viewport topographic backdrop behind everything. */}
      <AppBackground />

      {/* While the stored session is being read back we know neither answer.
          Rendering the login screen in the meantime would flash it on every
          refresh, so show nothing for that moment. */}
      {loading ? null : session ? (
        <AppShell />
      ) : (
        <LoginPage onAuthed={setSeeds} />
      )}

      {seeds && (
        <PortalTransition seeds={seeds} onComplete={() => setSeeds(null)} />
      )}
    </div>
  )
}

/** Everything behind the name gate. The sidebar lives here, outside <main>, so
 *  it persists across every section including Home. */
function AppShell() {
  const navigate = useNavigate()
  const { pathname, key } = useLocation()

  // The dashboard is open when its URL is showing; the toggle is a navigation.
  const financeOpen = pathname === FINANCE_PATH
  // 'default' means this was the first entry — a direct link to /money, with
  // nothing to go back to. Send those home instead of out of the app.
  const closeFinance = () => (key === 'default' ? navigate('/') : navigate(-1))
  const toggleFinance = () => (financeOpen ? closeFinance() : navigate(FINANCE_PATH))
  const goTo = name => navigate(PATH_BY_NAME[name] ?? '/')

  const panelProps = { financeOpen, onToggleFinance: toggleFinance, onGoTo: goTo }

  return (
    <>
      <Routes>
        {/* Home is deliberately chrome-free: no nav, no title, no sidebar.
            Every other section keeps the full shell, and its nav is the way
            back here. Finance renders over whichever one was already there. */}
        <Route path="/" element={<HomePage {...panelProps} />} />
        <Route path={FINANCE_PATH} element={<HomePage {...panelProps} />} />

        {SECTIONS.filter(s => s.path !== '/').map(({ path, name, Panel }) => (
          <Route
            key={path}
            path={path}
            element={
              <Chrome financeOpen={financeOpen} onToggleFinance={toggleFinance}>
                {/* key forces a fresh mount on section change, restarting the
                    panel-in animation. Panels that don't take these props
                    ignore them. */}
                <Panel key={path} {...panelProps} />
              </Chrome>
            }
          />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {financeOpen && <SpendingDashboard onClose={closeFinance} />}

      {/* Octi sits outside <Routes> so he survives every navigation. */}
      <OctiDock />
    </>
  )
}

/** Header, nav and sidebar — the frame every section but Home sits inside. */
function Chrome({ financeOpen, onToggleFinance, children }) {
  return (
    <>
      <header>
        <div className="titlebar">
          <h1>
            {/* Badge keyed out by scripts/make-logo-mark.mjs. */}
            <img src="/logo-mark.png" alt="" className="brand-mark" />
            Student OS
          </h1>
          <div className="titlebar-actions">
            <SyncBadge />
            <ThemeToggle />
            <button className="theme-toggle" onClick={signOut}>Sign out</button>
          </div>
        </div>

        <nav>
          {SECTIONS.map(({ path, name }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            >
              {name}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="body">
        {/* Sidebar column: the app shortcuts, then Finance as its own card. */}
        <div className="side">
          <AppLauncherSidebar />
          <SpendingToggle open={financeOpen} onToggle={onToggleFinance} />
        </div>

        <main>{children}</main>
      </div>
    </>
  )
}

/**
 * Says whether your data has reached the server.
 *
 * Shown only when it hasn't. A permanent green "Synced" badge is noise —
 * people stop reading it within a day, which is exactly when it would matter.
 * Silence means saved.
 */
function SyncBadge() {
  const { sync } = useStore()
  if (sync !== 'local') return null

  return (
    <span className="sync-badge" role="status">
      Saved on this device
    </span>
  )
}

// Cycles System → Light → Dark. The store writes the choice to <html> as
// data-theme; 'system' removes the attribute so the OS preference applies.
const ORDER = ['system', 'light', 'dark']
const LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' }

export function ThemeToggle() {
  const { state, dispatch } = useStore()
  const next = ORDER[(ORDER.indexOf(state.theme) + 1) % ORDER.length]

  return (
    <button
      className="theme-toggle"
      onClick={() => dispatch({ type: 'set-theme', value: next })}
      aria-label={`Theme: ${LABEL[state.theme]}. Switch to ${LABEL[next]}.`}
    >
      {LABEL[state.theme]}
    </button>
  )
}
