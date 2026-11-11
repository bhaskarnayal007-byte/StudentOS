// The /settings page: display name, text size, theme, Home layout, account and legal links.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { signOut, deleteAccount, setName } from '../auth/useSession.js'
import { Copyright } from './legal/LegalPage'
import { TagForm } from './FriendsPage.jsx'
import { setTag, useMyProfile } from '../lib/social.js'
import { AvatarPicker } from './Avatar.jsx'
import { LABELS, move, resolve } from '../lib/homeLayout.js'
import { PHONE, useMatchMedia } from '../lib/useMatchMedia.js'

// Multipliers for --fs in theme.css.
const TEXT_SIZES = [
  [0.9, 'Small'],
  [1, 'Default'],
  [1.15, 'Large'],
  [1.3, 'Extra large'],
]

// Each id is a [data-theme] block in theme.css. 'system' removes data-theme
// from <html> so the OS preference applies.
const THEMES = [
  ['system', 'Auto'],
  ['dark', 'Dark'],
  ['truedark', 'True dark'],
  ['minimal', 'Minimalist'],
  ['y2k', 'Y2K'],
  ['academia', 'Dark academia'],
  ['terminal', 'Terminal'],
]

/** Theme, account and legal — everything that isn't a section of its own. */
export default function SettingsPage() {
  const { state, dispatch } = useStore()

  return (
    <main className="legal settings">
      <Link to="/" className="legal-back">← Stratus</Link>
      <h1>Settings</h1>

      <h2>Your name</h2>
      {/* key re-seeds the field once the stored name arrives after a reload. */}
      <NameForm key={state.profileName} current={state.profileName} />

      <h2>Your tag and picture</h2>
      <TagSetting name={state.profileName} />

      <h2>Theme</h2>
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {THEMES.map(([value, label]) => (
          // The card wears its own theme, so it previews the real look.
          <button
            key={value}
            role="radio"
            aria-checked={state.theme === value}
            className="theme-card"
            data-theme={value === 'system' ? 'light' : value}
            onClick={() => dispatch({ type: 'set-theme', value })}
          >
            <span className={value === 'system' ? 'theme-swatch split' : 'theme-swatch'}>Aa</span>
            <span className="theme-name">{label}</span>
          </button>
        ))}
      </div>

      <h2>Text size</h2>
      <div className="settings-row" role="radiogroup" aria-label="Text size">
        {TEXT_SIZES.map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={state.textSize === value}
            className={state.textSize === value ? 'theme-toggle active' : 'theme-toggle'}
            // Each label is drawn at the size it would set.
            style={{ fontSize: `${value * 14}px` }}
            onClick={() => dispatch({ type: 'set-text-size', value })}
          >
            {label}
          </button>
        ))}
      </div>

      <h2>Home layout</h2>
      <HomeLayoutSetting />

      <h2>Account</h2>
      <div className="settings-row">
        <button className="theme-toggle" onClick={signOut}>Sign out</button>
        <button className="theme-toggle danger" onClick={confirmDeleteAccount}>Delete account</button>
      </div>

      <Copyright />
    </main>
  )
}

/** What Home greets you as. */
function NameForm({ current }) {
  const [name, setDraft] = useState(current)
  const [status, setStatus] = useState('')
  const trimmed = name.trim()

  async function save(e) {
    e.preventDefault()
    setStatus('Saving…')
    try {
      await setName(trimmed)
      setStatus('Saved')
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <form className="settings-row" onSubmit={save}>
      <input
        aria-label="What should we call you?"
        placeholder="What should we call you?"
        value={name}
        maxLength={40}
        onChange={e => { setDraft(e.target.value); setStatus('') }}
      />
      <button className="theme-toggle" disabled={!trimmed || trimmed === current}>Save</button>
      {status && <span className="settings-status" role="status">{status}</span>}
    </form>
  )
}

/** The @tag friends find you by, and the picture they see. */
function TagSetting({ name }) {
  const profile = useMyProfile()
  const [status, setStatus] = useState('')

  async function save(next) {
    setStatus('Saving…')
    try {
      await setTag(next, name || '')
      setStatus('Saved')
    } catch (err) {
      setStatus(err.message)
    }
  }

  if (profile === undefined) return null
  return (
    <>
      {profile && <AvatarPicker profile={profile} size={64} />}
      <TagForm key={profile?.tag} current={profile?.tag ?? ''} onSave={save} />
      {status && <span className="settings-status" role="status">{status}</span>}
    </>
  )
}

/** Irreversible, so it asks for the word, not just an OK click. */
/**
 * Reorder and show or hide Home's islands. Laptops and phones each keep their
 * own layout; this edits the one for the device you're on unless you switch.
 */
function HomeLayoutSetting() {
  const { state, dispatch } = useStore()
  const [device, setDevice] = useState(useMatchMedia(PHONE) ? 'phone' : 'wide')
  const layout = resolve(state.homeLayout?.[device], device)
  const save = next => dispatch({ type: 'set-home-layout', device, layout: next })
  const octiAt = layout.order.indexOf('octi')
  const wide = device === 'wide'

  return (
    <>
      <div className="settings-row" role="radiogroup" aria-label="Which layout">
        {[['wide', 'Laptop'], ['phone', 'Phone']].map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={device === value}
            className={device === value ? 'theme-toggle active' : 'theme-toggle'}
            onClick={() => setDevice(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted">
        {wide
          ? 'Islands above Octi sit on the left of Home, below him on the right. Untick one to hide it.'
          : 'Top to bottom, the way Home scrolls. Untick one to hide it.'}
      </p>

      <ol className="layout-list">
        {layout.order.map((id, i) => {
          const hidden = layout.hidden.includes(id)
          const side = wide && id !== 'octi' ? (i < octiAt ? 'Left' : 'Right') : null
          return (
            <li key={id} className={'layout-row' + (id === 'octi' ? ' octi' : '') + (hidden ? ' off' : '')}>
              <span className="grow">{LABELS[id]}</span>
              {side && <span className="chip">{side}</span>}
              {id === 'octi' ? (
                <span className="muted layout-always">{wide ? 'Middle' : 'Always on'}</span>
              ) : (
                <label className="layout-show">
                  <input
                    type="checkbox"
                    checked={!hidden}
                    aria-label={`Show ${LABELS[id]}`}
                    onChange={() => save({ ...layout, hidden: hidden ? layout.hidden.filter(h => h !== id) : [...layout.hidden, id] })}
                  />
                  <span className="layout-show-text">Show</span>
                </label>
              )}
              <button className="map-icon" aria-label={`Move ${LABELS[id]} up`} disabled={i === 0} onClick={() => save({ ...layout, order: move(layout.order, id, -1) })}>↑</button>
              <button className="map-icon" aria-label={`Move ${LABELS[id]} down`} disabled={i === layout.order.length - 1} onClick={() => save({ ...layout, order: move(layout.order, id, 1) })}>↓</button>
            </li>
          )
        })}
      </ol>
      <div className="settings-row">
        <button className="theme-toggle" onClick={() => save(undefined)}>Reset to default</button>
      </div>
    </>
  )
}

async function confirmDeleteAccount() {
  const typed = window.prompt(
    'This permanently deletes your account and everything in it: tasks, notes, PDFs, schedule, spending. It cannot be undone.\n\nType DELETE to confirm.',
  )
  if (typed?.trim() !== 'DELETE') return
  try {
    await deleteAccount()
  } catch (err) {
    window.alert(err.message)
  }
}
