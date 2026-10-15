import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { signOut, deleteAccount, setName } from '../auth/useSession.js'
import { Copyright } from './Legal'

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
  ['minimal', 'Minimalist'],
  ['y2k', 'Y2K'],
  ['academia', 'Dark academia'],
  ['terminal', 'Terminal'],
]

/** Theme, account and legal — everything that isn't a section of its own. */
export default function Settings() {
  const { state, dispatch } = useStore()

  return (
    <main className="legal settings">
      <Link to="/" className="legal-back">← Student OS</Link>
      <h1>Settings</h1>

      <h2>Your name</h2>
      {/* key re-seeds the field once the stored name arrives after a reload. */}
      <NameForm key={state.profileName} current={state.profileName} />

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

/** Irreversible, so it asks for the word, not just an OK click. */
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
