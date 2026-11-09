// Friend requests slide in from the side of the screen, on any page, until you
// accept, decline or wave them off for now.
import { useCallback, useEffect, useState } from 'react'
import * as social from '../lib/social.js'
import Avatar from './Avatar.jsx'

export default function FriendRequestPopups() {
  const [requests, setRequests] = useState([])
  // Waved off for this visit; they come back next time the app opens.
  const [later, setLater] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(
    () => social.listFriends()
      .then(rows => setRequests(rows.filter(r => r.status === 'pending' && r.incoming)))
      .catch(() => {}), // no tag yet, or signed out: nothing to show
    [],
  )
  useEffect(() => {
    load()
    return social.subscribe(load)
  }, [load])

  const act = fn => async () => {
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const shown = requests.filter(r => !later.includes(r.id))
  if (shown.length === 0) return null

  return (
    <div className="request-popups" role="region" aria-label="Friend requests">
      {shown.map(r => (
        <div key={r.id} className="request-popup" role="alert">
          <Avatar profile={r.friend} size={40} />
          <div className="request-popup-text">
            <b>{r.friend.name || `@${r.friend.tag}`}</b>
            <small className="muted">@{r.friend.tag} wants to be friends</small>
            <div className="row">
              <button className="primary" onClick={act(() => social.accept(r.id))}>Accept</button>
              <button onClick={act(() => social.removeFriend(r.id))}>Decline</button>
            </div>
          </div>
          <button className="ghost always request-popup-close" aria-label="Later" onClick={() => setLater(l => [...l, r.id])}>✕</button>
        </div>
      ))}
      {error && <p className="settings-status" role="alert">{error}</p>}
    </div>
  )
}
