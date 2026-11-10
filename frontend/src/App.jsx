import { Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useBackNavigation } from './lib/backButton.js'
import { AlarmWatcher } from './components/TimersPage.jsx'
import AppLauncherSidebar from './components/AppLauncherSidebar.jsx'
import { useStore } from './store.jsx'
import { uploadPending } from './lib/fileStore.js'
import AppBackground from './components/AppBackground.jsx'
import SpendingToggle from './components/finance/SpendingToggle'
import MobileNav, { pageName } from './components/MobileNav.jsx'
import HomePage from './components/home/HomePage'
import PortalTransition from './components/PortalTransition'
import OctiDock from './components/OctiDock'
import FriendRequestPopups from './components/FriendRequestPopups.jsx'
import LandingPage from './components/LandingPage'
import TimersPage from './components/TimersPage.jsx'
// OctiDock already pulls OctiPage into the first download, so lazy() would
// split nothing.
import OctiPage from './components/OctiPage.jsx'

// Only the first screen (Home, or the landing page when signed out) and what
// is mounted on every screen load up front. Every other page arrives the first
// time it is opened, which kept a cold start on a cheap Android phone from
// parsing the whole app. The service worker still precaches them all, so they
// open offline too.
// The dashboard's charts (recharts and its dependencies) were about a third of
// the JavaScript every screen downloaded.
const SpendingDashboard = lazy(() => import('./components/finance/SpendingDashboard'))
const TasksPage = lazy(() => import('./components/TasksPage.jsx'))
const CalendarPage = lazy(() => import('./components/CalendarPage.jsx'))
const SchedulePage = lazy(() => import('./components/SchedulePage.jsx'))
const CoursesPage = lazy(() => import('./components/CoursesPage.jsx'))
const CourseMapPage = lazy(() => import('./components/CourseMapPage.jsx'))
const NotesPage = lazy(() => import('./components/NotesPage.jsx'))
const FileTab = lazy(() => import('./components/NotesPage.jsx').then(m => ({ default: m.FileTab })))
const LoginPage = lazy(() => import('./components/auth/LoginPage'))
const PrivacyPage = lazy(() => import('./components/legal/PrivacyPage'))
const TermsPage = lazy(() => import('./components/legal/TermsPage'))
const SettingsPage = lazy(() => import('./components/SettingsPage.jsx'))
const FriendsPage = lazy(() => import('./components/FriendsPage.jsx'))
const ChatsPage = lazy(() => import('./components/ChatsPage.jsx'))
import { useUnread } from './lib/chat.js'
import { useSession } from './auth/useSession.js'

// One entry per section: the URL it lives at, the label in the nav, and the
// component that draws it. Adding a section later = one line here plus one
// new file. Home is first, so it's the landing view.
export const SECTIONS = [
  { path: '/', name: 'Home', Panel: HomePage },
  { path: '/tasks', name: 'Tasks', Panel: TasksPage },
  { path: '/courses', name: 'Courses', Panel: CoursesPage },
  { path: '/notes', name: 'Notes', Panel: NotesPage },
  { path: '/calendar', name: 'Calendar', Panel: CalendarPage },
  { path: '/schedule', name: 'Schedule', Panel: SchedulePage },
  { path: '/timers', name: 'Timers', Panel: TimersPage },
  { path: '/octi', name: 'Octi', Panel: OctiPage },
  { path: '/friends', name: 'Friends', Panel: FriendsPage },
  { path: '/chat', name: 'Chats', Panel: ChatsPage },
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
        /* Signed out, "/" is the pitch rather than a password field — someone
           who has never heard of this needs to know what it is first. */
        <Suspense fallback={null}>
        <Routes>
          <Route path="/signin" element={<LoginPage onAuthed={setSeeds} />} />
          {/* Its own URL so "Start for free" opens the create-account side
              rather than dropping a first-timer on "Welcome back". */}
          <Route path="/signup" element={<LoginPage onAuthed={setSeeds} initialMode="signup" />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          {/* A deep link into the app while signed out lands on the pitch,
              not a dead end. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
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

  // A new screen starts at its top, like a new page in any app; React Router
  // leaves the scroll where the last screen had it.
  // A block body on purpose: newer browsers return a Promise from scrollTo,
  // and an effect may only return its cleanup function.
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  // Android's back button, once no overlay has taken it: back through
  // history, then Home, then (returning false) the app goes to the background.
  useBackNavigation(({ canGoBack }) => {
    if (canGoBack) return navigate(-1), true
    if (pathname !== '/') return navigate('/', { replace: true }), true
    return false
  })

  return (
    <>
      {/* Pages outside the frame (settings, legal, a file) wait here; pages
          inside it wait in <main>, so the header stays put. */}
      <Suspense fallback={null}>
      <Routes>
        {/* Home is deliberately chrome-free: no nav, no title, no sidebar.
            Every other section keeps the full shell, and its nav is the way
            back here. Finance renders over whichever one was already there. */}
        <Route path="/" element={<HomePage {...panelProps} />} />
        <Route path={FINANCE_PATH} element={<HomePage {...panelProps} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* A note's file on its own, opened from Notes in a new tab. */}
        <Route path="/view/:id" element={<FileTab />} />
        {/* A subject's mind map, inside the usual frame so Courses stays lit. */}
        <Route
          path="/courses/:id"
          element={
            <Chrome financeOpen={financeOpen} onToggleFinance={toggleFinance}>
              <CourseMapPage />
            </Chrome>
          }
        />

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
      </Suspense>

      {financeOpen && (
        <Suspense fallback={null}>
          <SpendingDashboard onClose={closeFinance} />
        </Suspense>
      )}

      {/* Octi sits outside <Routes> so he survives every navigation. */}
      <OctiDock />
      <FriendRequestPopups />
      <NoteFileSync />
      <MobileNav />
    </>
  )
}

/**
 * Draws nothing. Note files this device holds but the account doesn't yet
 * (added offline, or before files synced) go up, so every device can open them.
 */
function NoteFileSync() {
  const { state } = useStore()
  const notes = useRef(state.notes)
  notes.current = state.notes
  useEffect(() => { uploadPending(state.notes) }, [state.notes])
  // A failed or offline upload tries again on reconnecting or coming back to the app.
  useEffect(() => {
    const retry = () => { if (document.visibilityState === 'visible') uploadPending(notes.current) }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [])
  return null
}

/** Header, nav and sidebar — the frame every section but Home sits inside. */
function Chrome({ financeOpen, onToggleFinance, children }) {
  const { pathname } = useLocation()
  // Notes wants every pixel for writing, so the Finance card stays off it.
  const onNotes = pathname === '/notes'
  const segments = pathname.split('/').filter(Boolean)
  const parent = segments.length > 1 ? `/${segments[0]}` : null

  return (
    <>
      <header>
        <div className="titlebar">
          <h1>
            {/* Same file as the app icon, so the install caches it once. */}
            <img src="/pwa-512.png" alt="" className="brand-mark" />
            {/* Phones title the page instead of the app (see theme.css). */}
            <span className="brand-name">Stratus</span>
            {/* A page inside a section (a subject's mind map) gets a way up
                to the section, since the phone has no header nav. */}
            {parent && (
              <Link to={parent} className="page-back" aria-label={`Back to ${pageName(pathname)}`}>‹</Link>
            )}
            <span className="page-name">{pageName(pathname)}</span>
          </h1>
          <div className="titlebar-actions">
            <SyncBadge />
            <SettingsButton />
          </div>
        </div>

        <nav>
          <SectionTabs />
        </nav>
      </header>

      <div className="body">
        {/* Sidebar column: the app shortcuts, then Finance as its own card. */}
        <div className="side">
          <AppLauncherSidebar />
          {!onNotes && <SpendingToggle open={financeOpen} onToggle={onToggleFinance} />}
        </div>

        <main><Suspense fallback={null}>{children}</Suspense></main>
      </div>
    </>
  )
}

/** One tab per section, for the header nav and the phone dock alike. */
function SectionTabs() {
  return SECTIONS.map(({ path, name }) => (
    <NavLink
      key={path}
      to={path}
      end={path === '/'}
      className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
    >
      {/* Chats carries the unread count. */}
      {name}{name === 'Chats' && <ChatsBadge />}
    </NavLink>
  ))
}

function ChatsBadge() {
  const unread = useUnread()
  return unread > 0 ? <span className="unread-badge" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span> : null
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

/** Theme, account and legal all live on /settings. */
export function SettingsButton() {
  return (
    <Link to="/settings" className="theme-toggle settings-btn" aria-label="Settings" title="Settings">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  )
}
