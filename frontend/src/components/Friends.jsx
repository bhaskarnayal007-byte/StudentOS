import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import * as social from '../lib/social.js'
import { describe, importShare } from '../lib/shareCopy.js'
import Avatar, { AvatarPicker } from './Avatar.jsx'

const KIND = { note: 'Note', event: 'Event', map: 'Mind map' }

/** Your tag, your friends, and what they've sent you. */
export default function Friends() {
  const { state, dispatch } = useStore()
  const me = social.useMyProfile() // undefined = loading, null = no tag yet
  const [friends, setFriends] = useState([])
  const [inbox, setInbox] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [rows, items] = await Promise.all([social.listFriends(), social.inbox()])
      setFriends(rows)
      setInbox(items)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
    return social.subscribe(load)
  }, [load])

  // Every action: run it, then refetch; errors land in one place.
  const run = fn => async (...args) => {
    setError('')
    try {
      await fn(...args)
      await load()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  const senderOf = id => friends.find(f => f.friend.user_id === id)?.friend ?? { tag: 'someone' }

  if (me === undefined && !error) return <p className="placeholder">Loading…</p>

  if (!me) {
    return (
      <div>
        <p className="muted">Pick a tag so friends can find you. Letters, numbers and _ only.</p>
        <TagForm onSave={run(tag => social.setTag(tag, state.profileName || ''))} />
        {error && <p className="settings-status" role="alert">{error}</p>}
      </div>
    )
  }

  const accepted = friends.filter(f => f.status === 'accepted')
  const incoming = friends.filter(f => f.status === 'pending' && f.incoming)
  const outgoing = friends.filter(f => f.status === 'pending' && !f.incoming)

  return (
    <div>
      <div className="friends-me">
        <AvatarPicker profile={me} size={64} />
        <div>
          <b>@{me.tag}</b>
          <p className="muted">Tap your picture to change it.</p>
        </div>
      </div>

      <AddFriend onAdd={run(social.sendRequest)} />
      {error && <p className="settings-status" role="alert">{error}</p>}

      <h3>Inbox</h3>
      {inbox.length === 0 ? (
        <p className="placeholder">Nothing shared with you yet.</p>
      ) : (
        <ul className="list">
          {inbox.map(s => (
            <li key={s.id} className="item">
              <Avatar profile={senderOf(s.sender)} size={32} />
              <span className="grow">
                <span className="chip">{KIND[s.kind]}</span> {describe(s)}{' '}
                <small className="muted">from @{senderOf(s.sender).tag}</small>
              </span>
              <button
                className="primary"
                onClick={run(async () => {
                  importShare(s, state, dispatch)
                  await social.dismiss(s.id)
                })}
              >
                Add
              </button>
              <button className="ghost" aria-label="Dismiss" onClick={run(() => social.dismiss(s.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <>
          <h3>Requests</h3>
          <ul className="list">
            {incoming.map(f => (
              <li key={f.id} className="item">
                <Avatar profile={f.friend} size={32} />
                <span className="grow">@{f.friend.tag} {f.friend.name && <small className="muted">{f.friend.name}</small>}</span>
                <button className="primary" onClick={run(() => social.accept(f.id))}>Accept</button>
                <button className="ghost" aria-label="Decline" onClick={run(() => social.removeFriend(f.id))}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Friends</h3>
      {accepted.length + outgoing.length === 0 ? (
        <p className="placeholder">No friends yet. Add one by their tag above.</p>
      ) : (
        <ul className="list">
          {[...accepted, ...outgoing].map(f => (
            <li key={f.id} className="item">
              <Avatar profile={f.friend} size={32} />
              <span className="grow">@{f.friend.tag} {f.friend.name && <small className="muted">{f.friend.name}</small>}</span>
              {f.status === 'pending' && <span className="chip">pending</span>}
              <button
                className="ghost"
                aria-label={`Remove @${f.friend.tag}`}
                onClick={run(() => window.confirm(`Remove @${f.friend.tag}?`) && social.removeFriend(f.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddFriend({ onAdd }) {
  const [tag, setTag] = useState('')
  return (
    <form className="row" onSubmit={e => { e.preventDefault(); if (tag.trim()) onAdd(tag).then(ok => ok && setTag('')) }}>
      <input className="grow" placeholder="Add a friend by tag — @maya" value={tag} onChange={e => setTag(e.target.value)} maxLength={21} />
      <button className="primary">Add</button>
    </form>
  )
}

/** Shared with Settings, where the tag can be changed later. */
export function TagForm({ current = '', onSave }) {
  const [tag, setTag] = useState(current)
  const [check, setCheck] = useState('') // '', 'checking', 'free', 'taken', 'mine', 'invalid'
  const clean = social.cleanTag(tag)

  // Ask whether it's free a moment after typing stops. The database's unique
  // index still has the final word if two people grab it at once.
  useEffect(() => {
    if (!clean || clean === current) return setCheck('')
    if (!social.validTag(clean)) return setCheck('invalid')
    setCheck('checking')
    const t = setTimeout(() => social.tagStatus(clean).then(setCheck, () => setCheck('')), 350)
    return () => clearTimeout(t)
  }, [clean, current])

  const hint = {
    invalid: '3–20 letters, numbers or _',
    checking: 'Checking…',
    free: `✓ @${clean} is available`,
    taken: `✗ @${clean} is taken`,
  }[check]

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(tag) }}>
      <div className="row">
        <input
          className="grow"
          aria-label="Your tag"
          aria-invalid={check === 'taken' || check === 'invalid'}
          placeholder="your_tag"
          value={tag}
          maxLength={21}
          onChange={e => setTag(e.target.value)}
        />
        <button className="primary" disabled={!['free', 'mine'].includes(check)}>Save</button>
      </div>
      {hint && <p className={`tag-hint tag-${check}`} role="status">{hint}</p>}
    </form>
  )
}
