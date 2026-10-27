import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as chat from '../lib/chat.js'
import { listFriends, useMyProfile } from '../lib/social.js'
import { chatTitle, cleanBody, layoutMessages, otherMember, preview, senderName, timeLabel, MAX_BODY } from '../lib/chatFormat.js'
import Avatar from './Avatar.jsx'

/**
 * Chats with friends, one-to-one and in groups. Laid out like Notes (and
 * reusing its classes): the list on the left, the open chat beside it; on a
 * phone, one at a time with a back button.
 */
export default function Chat() {
  const profile = useMyProfile() // undefined = loading, null = no tag yet
  const [params, setParams] = useSearchParams()
  const openId = params.get('id')
  const [myId, setMyId] = useState(null)
  const [chats, setChats] = useState(null)
  const [mode, setMode] = useState(null) // null | 'new' | 'group'
  const [error, setError] = useState('')

  const open = id => setParams(id ? { id } : {}, { replace: !!openId && !!id })

  const load = useCallback(async () => {
    try {
      setChats(await chat.listChats())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    chat.me().then(setMyId, () => {})
    load()
    return chat.subscribe({ onChange: load })
  }, [load])

  if (profile === undefined && !error) return <p className="placeholder">Loading…</p>
  if (profile === null) {
    return (
      <p className="placeholder">
        Pick a tag and add friends first — <Link to="/friends">go to Friends</Link>.
      </p>
    )
  }

  const current = chats?.find(c => c.id === openId)

  return (
    <div className={'notes messenger' + (openId || mode ? ' notes-reading' : '')}>
      <aside className="notes-side">
        <div className="row notes-add">
          <button className="primary grow" onClick={() => setMode('new')}>+ New chat</button>
          <button onClick={() => setMode('group')}>+ Group</button>
        </div>
        {error && <p className="settings-status" role="alert">{error}</p>}

        <ul className="notes-index">
          {(chats ?? []).map(c => (
            <li key={c.id}>
              <button
                className={c.id === openId ? 'notes-item messenger-item active' : 'notes-item messenger-item'}
                onClick={() => { setMode(null); open(c.id) }}
              >
                <ChatAvatar chat={c} myId={myId} />
                <span className="messenger-item-text">
                  <span className="notes-item-title">{chatTitle(c, myId)}</span>
                  <span className="notes-item-snippet">{preview(c, myId)}</span>
                </span>
                <span className="messenger-item-side">
                  {c.last_message_at && <small className="muted">{timeLabel(c.last_message_at)}</small>}
                  {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {chats?.length === 0 && <p className="placeholder">No chats yet. Start one with a friend.</p>}
      </aside>

      <section className="notes-editor messenger-pane">
        {mode ? (
          <NewChat
            group={mode === 'group'}
            onCancel={() => setMode(null)}
            onDone={async id => { setMode(null); await load(); open(id) }}
          />
        ) : current && myId ? (
          <Conversation
            key={current.id}
            chatInfo={current}
            myId={myId}
            onBack={() => open(null)}
            onLeft={async () => { open(null); await load() }}
            onRead={load}
          />
        ) : (
          <p className="placeholder">Pick a chat, or start a new one.</p>
        )}
      </section>
    </div>
  )
}

function ChatAvatar({ chat: c, myId }) {
  const other = otherMember(c, myId)
  if (other) return <Avatar profile={other} size={36} />
  return <span className="messenger-group-icon" aria-hidden="true">{(c.title || 'G').charAt(0).toUpperCase()}</span>
}

// ── Starting a chat or a group ────────────────────────────────────────────────
function NewChat({ group, onCancel, onDone }) {
  const [friends, setFriends] = useState(null)
  const [picked, setPicked] = useState([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listFriends()
      .then(rows => setFriends(rows.filter(r => r.status === 'accepted').map(r => r.friend)))
      .catch(err => setError(err.message))
  }, [])

  async function run(fn) {
    setError('')
    setBusy(true)
    try {
      await onDone(await fn())
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))

  return (
    <div className="messenger-new">
      <div className="messenger-head">
        <button className="ghost notes-back" onClick={onCancel}>← Chats</button>
        <h3>{group ? 'New group' : 'New chat'}</h3>
      </div>

      {friends === null && !error && <p className="placeholder">Loading friends…</p>}
      {friends?.length === 0 && (
        <p className="placeholder">No friends yet — <Link to="/friends">add one</Link> first.</p>
      )}
      {group && friends?.length > 0 && friends.length < 2 && (
        <p className="muted">A group needs at least 2 friends.</p>
      )}

      {group && friends?.length >= 2 && (
        <input
          placeholder="Group name"
          value={title}
          maxLength={60}
          onChange={e => setTitle(e.target.value)}
          aria-label="Group name"
        />
      )}

      <ul className="share-friends">
        {(friends ?? []).map(f => (
          <li key={f.user_id}>
            {group ? (
              <button
                type="button"
                className="share-friend"
                aria-pressed={picked.includes(f.user_id)}
                onClick={() => toggle(f.user_id)}
              >
                <Avatar profile={f} size={28} />
                <span className="grow">@{f.tag} {f.name && <small className="muted">{f.name}</small>}</span>
                <span className="share-check" aria-hidden="true">✓</span>
              </button>
            ) : (
              <button
                type="button"
                className="share-friend"
                disabled={busy}
                onClick={() => run(() => chat.startChat(f.user_id))}
              >
                <Avatar profile={f} size={28} />
                <span className="grow">@{f.tag} {f.name && <small className="muted">{f.name}</small>}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {group && friends?.length >= 2 && (
        <button
          className="primary"
          disabled={busy || !title.trim() || picked.length < 2}
          onClick={() => run(() => chat.createGroup(title.trim(), picked))}
        >
          Create group{picked.length ? ` (${picked.length + 1})` : ''}
        </button>
      )}
      {error && <p className="settings-status" role="alert">{error}</p>}
    </div>
  )
}

// ── One open chat ─────────────────────────────────────────────────────────────
function Conversation({ chatInfo, myId, onBack, onLeft, onRead }) {
  const [messages, setMessages] = useState([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const end = useRef(null)
  const stick = useRef(true) // scroll to the newest message after this render

  const id = chatInfo.id
  const read = useCallback(() => { chat.markRead(id).then(onRead, () => {}) }, [id, onRead])

  useEffect(() => {
    let alive = true
    chat.loadMessages(id)
      .then(page => {
        if (!alive) return
        setMessages(page.messages)
        setMore(page.more)
        setLoading(false)
        read()
      })
      .catch(err => { setError(err.message); setLoading(false) })

    // New messages in this chat arrive live; any arriving here are read.
    const stop = chat.subscribe({
      onMessage: m => {
        if (m.conversation_id !== id) return
        stick.current = true
        setMessages(list => (list.some(x => x.id === m.id) ? list : [...list, m]))
        if (m.sender !== myId) read()
      },
    })
    return () => { alive = false; stop() }
  }, [id, myId, read])

  useEffect(() => {
    if (stick.current) end.current?.scrollIntoView({ block: 'end' })
    stick.current = false
  }, [messages])

  async function older() {
    try {
      const page = await chat.loadMessages(id, messages[0]?.created_at)
      setMessages(list => [...page.messages, ...list])
      setMore(page.more)
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit(e) {
    e?.preventDefault()
    const body = cleanBody(draft)
    if (!body) return
    setError('')
    setDraft('')
    try {
      const sent = await chat.send(id, body)
      stick.current = true
      setMessages(list => (list.some(x => x.id === sent.id) ? list : [...list, sent]))
    } catch (err) {
      setDraft(body) // nothing typed is lost
      setError(err.message)
    }
  }

  async function leave() {
    if (!window.confirm(`Leave "${chatTitle(chatInfo, myId)}"?`)) return
    try {
      await chat.leave(id)
      onLeft()
    } catch (err) {
      setError(err.message)
    }
  }

  const rows = layoutMessages(messages)
  const others = chatInfo.members.filter(m => m.user_id !== myId)

  return (
    <div className="messenger-chat">
      <div className="messenger-head">
        <button className="ghost notes-back" onClick={onBack}>← Chats</button>
        <ChatAvatar chat={chatInfo} myId={myId} />
        <div className="messenger-head-text">
          <b>{chatTitle(chatInfo, myId)}</b>
          {chatInfo.is_group && (
            <small className="muted">{others.length + 1} people · {others.map(m => (m.name || `@${m.tag}`)).join(', ')}</small>
          )}
        </div>
        {chatInfo.is_group && <button className="ghost messenger-leave" onClick={leave}>Leave</button>}
      </div>

      <div className="messenger-messages" aria-live="polite">
        {more && <button className="ghost messenger-older" onClick={older}>Load older messages</button>}
        {loading && <p className="placeholder">Loading…</p>}
        {!loading && messages.length === 0 && <p className="placeholder">No messages yet. Say hello.</p>}
        {rows.map(r =>
          r.type === 'day' ? (
            <p key={r.key} className="messenger-day">{r.label}</p>
          ) : (
            <div key={r.key} className={r.message.sender === myId ? 'bubble-row mine' : 'bubble-row'}>
              {chatInfo.is_group && r.first && r.message.sender !== myId && (
                <small className="messenger-sender">{senderName(chatInfo, r.message.sender, myId)}</small>
              )}
              <p className="msg">
                {r.message.body}
                <time dateTime={r.message.created_at}>{timeLabel(r.message.created_at)}</time>
              </p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      {error && <p className="settings-status" role="alert">{error}</p>}

      {chatInfo.can_post ? (
        <form className="messenger-compose" onSubmit={submit}>
          <textarea
            rows={1}
            placeholder="Message"
            aria-label="Message"
            value={draft}
            maxLength={MAX_BODY}
            onChange={e => setDraft(e.target.value)}
            // Enter sends; Shift+Enter is a new line. Not while an IME is composing.
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
            }}
          />
          <button className="primary" disabled={!draft.trim()}>Send</button>
        </form>
      ) : (
        <p className="muted messenger-closed">You're no longer friends, so you can't send messages here.</p>
      )}
    </div>
  )
}
