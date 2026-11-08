// Phones only (theme.css hides it above 620px): the bottom tab bar and the
// "More" sheet behind its last tab.
import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useUnread } from '../lib/chat.js'
import { isNative } from '../lib/supabase.js'

/** 24px line icons, drawn in currentColor so the active tab can tint them. */
const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  tasks: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  notes: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  more: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  courses: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>,
  schedule: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  timers: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></>,
  friends: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chats: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  money: <><path d="M20 7H5a2 2 0 0 1 0-4h13v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15V7" /><circle cx="16" cy="14" r="1.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/** The four a student opens every day; everything else is one tap further, in More. */
const TABS = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/notes', label: 'Notes', icon: 'notes' },
]

const MORE = [
  { to: '/courses', label: 'Courses', icon: 'courses' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/timers', label: 'Timers', icon: 'timers' },
  { to: '/octi', label: 'Octi', icon: null },
  { to: '/friends', label: 'Friends', icon: 'friends' },
  { to: '/chat', label: 'Chats', icon: 'chats' },
  { to: '/money', label: 'Spending', icon: 'money' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

/**
 * The sheet is open while the URL ends in #more. Opening it is a navigation,
 * so Android's back button closes it instead of leaving the page behind it.
 */
const SHEET_HASH = '#more'

export default function MobileNav() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const unread = useUnread()
  const sheetOpen = hash === SHEET_HASH

  // A path the four tabs don't cover lights More instead.
  const inMore = !TABS.some(t => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)))
  const close = () => navigate(-1)

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = e => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            // In the app, tabs replace rather than stack, so back from a tab
            // goes Home (lib/backButton.js) instead of through every tab seen.
            replace={sheetOpen || isNative}
            className={({ isActive }) => `tabbar-item${isActive && !sheetOpen ? ' active' : ''}`}
            onClick={e => {
              // Tapping the tab you're on goes back to its top, as on any phone.
              if (pathname === to && !sheetOpen) {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
          >
            <span className="tabbar-icon"><Icon name={icon} /></span>
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          className={`tabbar-item${inMore || sheetOpen ? ' active' : ''}`}
          aria-expanded={sheetOpen}
          onClick={() => (sheetOpen ? close() : navigate({ hash: SHEET_HASH }))}
        >
          <span className="tabbar-icon">
            <Icon name="more" />
            {unread > 0 && <span className="tabbar-dot" aria-label={`${unread} unread`} />}
          </span>
          More
        </button>
      </nav>

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" role="dialog" aria-label="More sections" onClick={e => e.stopPropagation()}>
            <span className="sheet-grip" aria-hidden="true" />
            <ul className="sheet-grid">
              {MORE.map(({ to, label, icon }) => (
                <li key={to}>
                  {/* replace: the #more entry becomes the section, so back
                      from it goes where you were before opening the sheet. */}
                  <NavLink to={to} replace className={({ isActive }) => `sheet-tile${isActive ? ' active' : ''}`}>
                    <span className="sheet-icon">
                      {icon ? <Icon name={icon} /> : <span className="octi-tint sheet-octi" />}
                      {to === '/chat' && unread > 0 && <span className="tabbar-dot" />}
                    </span>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

/** The section name for the phone header, from the URL. */
export function pageName(pathname) {
  const hit = [...TABS, ...MORE].find(t => t.to !== '/' && pathname.startsWith(t.to))
  return hit ? hit.label : 'Home'
}
