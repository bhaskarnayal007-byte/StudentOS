import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { listFriends, share } from '../lib/social.js'
import { toPayload } from '../lib/shareCopy.js'
import Avatar from './Avatar.jsx'

// Every share button on a page wants the same list; ask once, briefly reuse it.
let cache = { at: 0, promise: null }
function friends() {
  if (!cache.promise || Date.now() - cache.at > 30_000) {
    cache = { at: Date.now(), promise: listFriends().then(rows => rows.filter(r => r.status === 'accepted')) }
    cache.promise.catch(() => { cache.promise = null })
  }
  return cache.promise
}

/**
 * "Share" toggles a small floating island: tick one or more friends, press
 * Send, and it closes itself once the copies are on their way.
 */
export default function ShareButton({ kind, item }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [status, setStatus] = useState('')
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    let live = true
    setList(null)
    friends().then(rows => live && setList(rows), err => live && setList(err))

    // Click outside or Escape closes it, like any popover.
    const away = e => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      live = false
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  function toggle() {
    setOpen(o => !o)
    setPicked(new Set())
    setStatus('')
  }

  function flip(id) {
    setPicked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function send() {
    setStatus('Sending…')
    try {
      const payload = toPayload(kind, item, state)
      await Promise.all([...picked].map(id => share(id, kind, payload)))
      setStatus(`Sent to ${picked.size} friend${picked.size === 1 ? '' : 's'}`)
      setTimeout(() => setOpen(false), 900)
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <span className="share" ref={wrap} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={open ? 'theme-toggle active' : 'theme-toggle'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        Share
      </button>

      {open && (
        <div className="share-island" role="dialog" aria-label="Share with friends">
          {list === null ? (
            <p className="muted">Loading friends…</p>
          ) : list instanceof Error ? (
            <p className="muted">{list.message}</p>
          ) : list.length === 0 ? (
            <p className="muted">No friends yet. <Link to="/friends">Add one</Link></p>
          ) : (
            <>
              <ul className="share-friends">
                {list.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="share-friend"
                      aria-pressed={picked.has(r.friend.user_id)}
                      onClick={() => flip(r.friend.user_id)}
                    >
                      <Avatar profile={r.friend} size={36} />
                      <span className="share-friend-tag">@{r.friend.tag}</span>
                      <span className="share-check" aria-hidden="true">✓</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="share-foot">
                <span className="muted" role="status">{status}</span>
                <button type="button" className="primary" disabled={!picked.size || status === 'Sending…' || status.startsWith('Sent')} onClick={send}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  )
}
