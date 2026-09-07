import { useEffect, useState } from 'react'
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
import { useSession, signOut } from './auth/useSession.js'

// Each tab maps to the component that draws it. Adding a tab later = one line
// here plus one new file. The rest of App.jsx never changes.
// Home is first, so it's the landing view.
const TABS = {
  Home: HomePage,
  Tasks: Tasks,
  Calendar: Calendar,
  Schedule: Schedule,
  Timers: Timers,
  Assistant: Assistant,
}

const NAMES = Object.keys(TABS)

export default function App() {
  const { state, dispatch } = useStore()
  const { session, loading } = useSession()
  const [tab, setTab] = useState('Home')
  // Lives here, not in the sidebar, because the toggle, the home grid and the
  // dashboard are rendered in three different places and all need it.
  const [financeOpen, setFinanceOpen] = useState(false)
  // Non-null only while the portal animation is running.
  const [seeds, setSeeds] = useState(null)

  const Panel = TABS[tab]
  const toggleFinance = () => setFinanceOpen(o => !o)

  // The name lives on the Supabase user, so it follows the account to any
  // device. Mirrored into the store because that's what HomePage reads.
  const displayName = session?.user?.user_metadata?.name ?? ''
  useEffect(() => {
    if (displayName && displayName !== state.profileName) {
      dispatch({ type: 'set-name', value: displayName })
    }
  }, [displayName, state.profileName, dispatch])

  // Everything shares one root so AppBackground mounts once and keeps running
  // across the login screen, the transition and the app — no restart, no flash.
  return (
    <div className="app">
      {/* Draws nothing; watches the clock so alarms ring on any tab. */}
      <AlarmWatcher />

      {/* Fixed, full-viewport topographic backdrop behind everything. */}
      <AppBackground />

      {/* While the stored session is being read back we know neither answer.
          Rendering the login screen in the meantime would flash it on every
          refresh, so show nothing for that moment. */}
      {loading ? null : session ? (
        <AppShell
          tab={tab}
          setTab={setTab}
          Panel={Panel}
          financeOpen={financeOpen}
          toggleFinance={toggleFinance}
        />
      ) : (
        <LoginPage onAuthed={setSeeds} />
      )}

      {seeds && (
        <PortalTransition seeds={seeds} onComplete={() => setSeeds(null)} />
      )}

      {financeOpen && <SpendingDashboard onClose={() => setFinanceOpen(false)} />}
    </div>
  )
}

/** Everything behind the name gate. The sidebar lives here, outside <main>, so
 *  it persists across every tab including Home. */
function AppShell({
  tab,
  setTab,
  Panel,
  financeOpen,
  toggleFinance,
}) {
  // Home is deliberately chrome-free: no nav, no title, no sidebar, no panel.
  // Every other tab keeps the full shell, and its nav is the way back here.
  if (tab === 'Home') {
    return (
      <Panel
        financeOpen={financeOpen}
        onToggleFinance={toggleFinance}
        onGoTo={setTab}
      />
    )
  }

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
            <ThemeToggle />
            <button className="theme-toggle" onClick={signOut}>Sign out</button>
          </div>
        </div>

        <nav>
          {NAMES.map(name => (
            <button
              key={name}
              className={name === tab ? 'tab active' : 'tab'}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      <div className="body">
        {/* Sidebar column: the app shortcuts, then Finance as its own card. */}
        <div className="side">
          <AppLauncherSidebar />
          <SpendingToggle open={financeOpen} onToggle={toggleFinance} />
        </div>

        {/* key={tab} forces a fresh mount on tab change, restarting the
            panel-in animation. Panels that don't take these props ignore them. */}
        <main key={tab}>
          <Panel
            financeOpen={financeOpen}
            onToggleFinance={toggleFinance}
            onGoTo={setTab}
          />
        </main>
      </div>
    </>
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
