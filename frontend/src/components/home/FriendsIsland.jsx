// Home's Friends island: friends, groups, requests and their chats, in place.
// Laptops: a bar above Timer that opens a panel beneath it. Phones (`compact`):
// a round button by Settings that opens the same panel as a bottom sheet.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as chat from '../../lib/chat.js'
import * as social from '../../lib/social.js'
import { chatTitle, otherMember, preview } from '../../lib/chatFormat.js'
import { useBackToClose } from '../../lib/backButton.js'
import Avatar from '../Avatar.jsx'
import { AddFriend } from '../FriendsPage.jsx'
import { ChatAvatar, Conversation, NewChat } from '../ChatsPage.jsx'

export default function FriendsIsland({ compact = false }) {
  const [open, setOpen] = useState(false)
  const unread = chat.useUnread()
  const [friends, setFriends] = useState([])
  const box = useRef(null)

  const loadFriends = useCallback(() => social.listFriends().then(setFriends, () => {}), [])
  useEffect(() => {
    loadFriends()
    return social.subscribe(loadFriends)
  }, [loadFriends])

  // Escape or a click anywhere else closes it, like any popover.
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    const onDown = e => box.current && !box.current.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  useBackToClose(() => setOpen(false), open)

  const accepted = friends.filter(f => f.status === 'accepted').map(f => f.friend)

  return (
    <div className={'friends-island' + (compact ? ' compact' : '') + (open ? ' open' : '')} ref={box}>
      <button
        type="button"
        className={compact ? 'theme-toggle friends-island-round' : 'friends-island-bar'}
        aria-expanded={open}
        aria-label={compact ? (unread ? `Friends, ${unread} unread` : 'Friends') : undefined}
        onClick={() => setOpen(o => !o)}
      >
        {compact ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ) : (
          <>
            <b>Friends</b>
            <span className="friends-island-faces" aria-hidden="true">
              {accepted.slice(0, 4).map(f => <Avatar key={f.user_id} profile={f} size={24} />)}
            </span>
          </>
        )}
        {unread > 0 && <span className="unread-badge" aria-label={compact ? undefined : `${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && compact && <div className="friends-sheet-backdrop" onClick={() => setOpen(false)} />}
      {open && <FriendsPanel friends={friends} onFriendsChange={loadFriends} onClose={compact ? () => setOpen(false) : null} />}
    </div>
  )
}

function FriendsPanel({ friends, onFriendsChange, onClose }) {
  const profile = social.useMyProfile() // undefined = loading, null = no tag yet
  const [view, setView] = useState('list') // 'list' | 'group' | a chat id
  const [chats, setChats] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => chat.listChats().then(setChats, err => setError(err.message)), [])
  useEffect(() => {
    chat.me().then(setMyId, () => {})
    load()
    return chat.subscribe({ onChange: load })
  }, [load])

  const back = () => setView('list')
  // Android's back from a chat (or a new group) returns to the list first.
  useBackToClose(back, view !== 'list')

  if (profile === null) {
    return (
      <div className="friends-panel">
        {onClose && <span className="sheet-grip" aria-hidden="true" />}
        <p className="placeholder">Pick a tag so friends can find you — <Link to="/friends">set it up</Link>.</p>
      </div>
    )
  }

  if (view === 'group') {
    return (
      <div className="friends-panel">
        {onClose && <span className="sheet-grip" aria-hidden="true" />}
        <NewChat group back="Friends" onCancel={back} onDone={async id => { await load(); setView(id) }} />
      </div>
    )
  }

  const current = chats?.find(c => c.id === view)
  if (current && myId) {
    return (
      <div className="friends-panel">
        {onClose && <span className="sheet-grip" aria-hidden="true" />}
        <Conversation key={current.id} chatInfo={current} myId={myId} back="Friends" onBack={back} onLeft={async () => { back(); await load() }} onRead={load} />
      </div>
    )
  }

  const groups = (chats ?? []).filter(c => c.is_group)
  const accepted = friends.filter(f => f.status === 'accepted')
  const outgoing = friends.filter(f => f.status === 'pending' && !f.incoming)
  // Requests waved off in the popup wait here until you decide.
  const incoming = friends.filter(f => f.status === 'pending' && f.incoming)
  const chatWith = id => (chats ?? []).find(c => otherMember(c, myId)?.user_id === id)

  // A friend's chat opens straight away, created the first time.
  async function openFriend(id) {
    setError('')
    try {
      const existing = chatWith(id)
      if (existing) return setView(existing.id)
      const newId = await chat.startChat(id)
      await load()
      setView(newId)
    } catch (err) {
      setError(err.message)
    }
  }

  // Every friend action: run it, refresh the list, show any error.
  async function run(fn) {
    setError('')
    try {
      await fn()
      onFriendsChange()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  return (
    <div className="friends-panel">
      {onClose && <span className="sheet-grip" aria-hidden="true" />}
      <div className="friends-panel-head">
        <h3>Friends</h3>
        <button className="primary" onClick={() => setView('group')}>+ Create group</button>
        {/* Phones: a plain way to close the sheet besides tapping outside. */}
        {onClose && <button className="ghost always friends-panel-close" aria-label="Close" onClick={onClose}>✕</button>}
      </div>
      <AddFriend onAdd={tag => run(() => social.sendRequest(tag))} />
      {error && <p className="settings-status" role="alert">{error}</p>}

      <div className="friends-panel-list">
        {incoming.length > 0 && (
          <>
            <h4>Requests</h4>
            <ul>
              {incoming.map(({ id, friend }) => (
                <li key={id}>
                  <span className="friends-row request">
                    <Avatar profile={friend} size={36} />
                    <span className="friends-row-text">
                      <b>{friend.name || `@${friend.tag}`}</b>
                      <small className="muted">@{friend.tag}</small>
                    </span>
                    <button className="primary" onClick={() => run(() => social.accept(id))}>Accept</button>
                    <button className="ghost always" aria-label={`Decline @${friend.tag}`} onClick={() => run(() => social.removeFriend(id))}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {groups.length > 0 && (
          <>
            <h4>Groups</h4>
            <ul>
              {groups.map(c => (
                <li key={c.id}>
                  <button className="friends-row" onClick={() => setView(c.id)}>
                    <ChatAvatar chat={c} myId={myId} />
                    <span className="friends-row-text">
                      <b>{chatTitle(c, myId)}</b>
                      <small className="muted">{preview(c, myId)}</small>
                    </span>
                    {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h4>Friends</h4>
        {accepted.length + outgoing.length === 0 && <p className="placeholder">No friends yet. Add one by their tag.</p>}
        <ul>
          {accepted.map(({ id, friend }) => {
            const c = chatWith(friend.user_id)
            return (
              <li key={id}>
                <button className="friends-row" onClick={() => openFriend(friend.user_id)}>
                  <Avatar profile={friend} size={36} />
                  <span className="friends-row-text">
                    <b>{friend.name || `@${friend.tag}`}</b>
                    <small className="muted">{c?.last_message_at ? preview(c, myId) : `@${friend.tag}`}</small>
                  </span>
                  {c?.unread > 0 && <span className="unread-badge">{c.unread}</span>}
                </button>
              </li>
            )
          })}
          {outgoing.map(({ id, friend }) => (
            <li key={id}>
              <span className="friends-row pending">
                <Avatar profile={friend} size={36} />
                <span className="friends-row-text">
                  <b>@{friend.tag}</b>
                  <small className="muted">Request sent</small>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
