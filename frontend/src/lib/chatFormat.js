// Chat display logic with no Supabase in it, so scripts/test-chat.mjs can run
// it in plain node.

export const MAX_BODY = 2000

/** The text to send, or null when there's nothing worth sending. */
export function cleanBody(text) {
  const body = (text ?? '').trim()
  if (!body) return null
  return body.slice(0, MAX_BODY)
}

const nameOf = p => (p?.name || '').trim() || (p?.tag ? `@${p.tag}` : 'Someone')

/** What a chat is called: the group's name, or the other person's. */
export function chatTitle(chat, myId) {
  if (chat.is_group) return chat.title || 'Group'
  const other = (chat.members || []).find(m => m.user_id !== myId)
  return other ? nameOf(other) : 'Just you'
}

/** The other person in a one-to-one chat (for the avatar), else null. */
export function otherMember(chat, myId) {
  if (chat.is_group) return null
  return (chat.members || []).find(m => m.user_id !== myId) ?? null
}

/** Display name for a sender id, from the chat's member list. */
export function senderName(chat, id, myId) {
  if (id === myId) return 'You'
  return nameOf((chat.members || []).find(m => m.user_id === id))
}

/** One-line preview for the chat list. */
export function preview(chat, myId) {
  if (!chat.last_body) return chat.is_group ? 'Group created' : 'Say hello'
  const who = chat.last_sender === myId ? 'You: ' : chat.is_group ? `${senderName(chat, chat.last_sender, myId)}: ` : ''
  return who + chat.last_body.replace(/\s+/g, ' ')
}

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "Today", "Yesterday", or a date like "Mon 3 Nov". */
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso)
  if (dayKey(d) === dayKey(now)) return 'Today'
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** "14:05" style, in the viewer's locale. */
export const timeLabel = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/**
 * Oldest-first messages → rows to render: a day header whenever the day
 * changes, and `first` on a message that starts a new run by its sender (so
 * the name is shown once per run in groups).
 */
export function layoutMessages(messages, now = new Date()) {
  const rows = []
  let lastDay = null
  let lastSender = null
  for (const m of messages) {
    const day = dayKey(new Date(m.created_at))
    if (day !== lastDay) {
      rows.push({ type: 'day', key: `day-${day}`, label: dayLabel(m.created_at, now) })
      lastDay = day
      lastSender = null
    }
    rows.push({ type: 'message', key: m.id, message: m, first: m.sender !== lastSender })
    lastSender = m.sender
  }
  return rows
}
