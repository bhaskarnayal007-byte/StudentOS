import { useState } from 'react'
import { useStore } from '../store.jsx'
import { CoursePicker, CourseChip } from './Courses.jsx'

/**
 * Quick notes, optionally filed under a subject.
 *
 * Edited in place rather than through a modal: a note is a textarea, and
 * putting a textarea behind a dialog adds two clicks to every correction.
 */
export default function Notes() {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [courseId, setCourseId] = useState(undefined)
  const [filter, setFilter] = useState('')

  function submit(e) {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    dispatch({ type: 'add-note', note: { text: clean, courseId } })
    setText('')
  }

  const shown = filter ? state.notes.filter(n => n.courseId === filter) : state.notes

  return (
    <div>
      <form className="note-form" onSubmit={submit}>
        <textarea
          className="grow note-input"
          placeholder="Anything worth keeping — a formula, what the lecturer said, a reminder to yourself."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
        />
        <div className="row note-actions">
          <CoursePicker value={courseId} onChange={setCourseId} />
          <button className="primary" disabled={!text.trim()}>Save note</button>
        </div>
      </form>

      {state.courses.length > 0 && state.notes.length > 0 && (
        <div className="row note-filter">
          <button
            className={filter ? 'tab' : 'tab active'}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {state.courses.map(c => (
            <button
              key={c.id}
              className={filter === c.id ? 'tab active' : 'tab'}
              onClick={() => setFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <p className="placeholder">
          {state.notes.length === 0
            ? 'No notes yet. Octi can write them for you too — just tell him.'
            : 'Nothing filed under that subject.'}
        </p>
      )}

      <ul className="list note-list">
        {shown.map(note => (
          <li key={note.id} className="note-card">
            <div className="note-meta">
              <CourseChip courseId={note.courseId} />
              <span className="muted">{when(note.updatedAt)}</span>
              <button
                className="ghost"
                aria-label="Delete note"
                onClick={() => dispatch({ type: 'delete-note', id: note.id })}
              >
                ✕
              </button>
            </div>

            {/* Editing writes straight to the store — there is no save button
                because there is nothing to save it from. */}
            <textarea
              className="note-body"
              value={note.text}
              rows={Math.min(10, note.text.split('\n').length + 1)}
              onChange={e =>
                dispatch({ type: 'update-note', id: note.id, changes: { text: e.target.value } })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "3 minutes ago" is noise on a note; the day it was written is not. */
function when(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date.getTime() >= today.getTime()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
