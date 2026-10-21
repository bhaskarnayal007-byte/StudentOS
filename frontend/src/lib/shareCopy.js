// What a shared item looks like on the wire, and how it becomes the
// recipient's own copy. Kept apart from social.js so it runs without Supabase
// (and so the tests can run it in node).

import { COLORS, outline } from '../ai/tools.js'

/** The part of an item worth sending. Note attachments live in this device's
 *  file store and are not sent. */
export function toPayload(kind, item, state) {
  if (kind === 'note') return { text: item.text }
  if (kind === 'event') return { title: item.title, date: item.date, time: item.time || '' }
  if (kind === 'map') return { name: item.name, topics: outline(state.topics || [], item.id) }
  throw new Error(`Can't share a ${kind}.`)
}

/** One-line preview for the inbox. */
export function describe({ kind, payload }) {
  if (kind === 'note') return (payload.text || '').split('\n').find(l => l.trim())?.trim().slice(0, 60) || 'Untitled'
  if (kind === 'event') return `${payload.title} · ${payload.date}${payload.time ? ` ${payload.time}` : ''}`
  return payload.name
}

/**
 * Turn a share into the recipient's own data, through the same actions the
 * app's buttons dispatch. Returns a short message for the UI.
 */
export function importShare({ kind, payload }, state, dispatch) {
  if (kind === 'note') {
    dispatch({ type: 'add-note', note: { text: String(payload.text || '') } })
    return 'Note added.'
  }

  if (kind === 'event') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date || '')) throw new Error('That event has no valid date.')
    dispatch({ type: 'add-event', event: { title: String(payload.title || 'Event'), date: payload.date, time: payload.time || '' } })
    return `Added to your calendar on ${payload.date}.`
  }

  if (kind === 'map') {
    const name = String(payload.name || '').trim() || 'Shared subject'
    // Same subject already here: merge into it rather than making a twin.
    let course = state.courses.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!course) {
      course = { id: crypto.randomUUID(), name, color: COLORS[state.courses.length % COLORS.length] }
      dispatch({ type: 'add-course', course })
    }
    // Ids made here so sub-topics can point at the topic added a moment ago.
    const add = (list, parentId, depth) => {
      if (!Array.isArray(list) || depth > 6) return
      for (const t of list) {
        const text = String(t?.name || '').trim().slice(0, 80)
        if (!text) continue
        const id = crypto.randomUUID()
        dispatch({ type: 'add-topic', topic: { id, courseId: course.id, parentId, text, done: Boolean(t.learned) } })
        add(t.subtopics, id, depth + 1)
      }
    }
    add(payload.topics, null, 0)
    return `Mind map added to ${course.name}.`
  }

  throw new Error(`Unknown share type "${kind}".`)
}
