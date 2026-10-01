import { useState } from 'react'
import { useStore } from '../store.jsx'

// The same six used by Schedule and the AI tools, so a subject's colour means
// the same thing wherever it appears.
export const COURSE_COLORS = ['#2E5334', '#5C6E4A', '#7A6A4F', '#3F5A63', '#6B4F3F', '#4A5240']

/** Subjects, and what is outstanding in each. */
export default function Courses() {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    dispatch({
      type: 'add-course',
      course: { name: clean, color: COURSE_COLORS[state.courses.length % COURSE_COLORS.length] },
    })
    setName('')
  }

  return (
    <div>
      <form className="row" onSubmit={submit}>
        <input
          className="grow"
          placeholder="Add a subject — Chemistry, Linear Algebra…"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
        />
        <button className="primary">Add</button>
      </form>

      {state.courses.length === 0 && (
        <p className="placeholder">
          No subjects yet. Add one and your tasks can belong to it.
        </p>
      )}

      <ul className="list">
        {state.courses.map(course => {
          const mine = state.tasks.filter(t => t.courseId === course.id)
          const open = mine.filter(t => !t.done).length

          return (
            <li key={course.id} className="item course-item">
              <span className="course-dot" style={{ background: course.color }} />
              <span className="grow">{course.name}</span>
              <span className="chip">
                {open === 0 ? (mine.length ? 'all done' : 'nothing yet') : `${open} open`}
              </span>
              <button
                className="ghost"
                aria-label={`Delete ${course.name}`}
                onClick={() => dispatch({ type: 'delete-course', id: course.id })}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>

      {state.courses.length > 0 && (
        <p className="muted course-note">
          Deleting a subject keeps its tasks — they just stop belonging to it.
        </p>
      )}
    </div>
  )
}

/** The subject picker shared by any form that can attach one. */
export function CoursePicker({ value, onChange }) {
  const { state } = useStore()
  if (state.courses.length === 0) return null

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || undefined)}
      aria-label="Subject"
    >
      <option value="">No subject</option>
      {state.courses.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}

/** The coloured chip shown on anything belonging to a subject. */
export function CourseChip({ courseId }) {
  const { state } = useStore()
  const course = state.courses.find(c => c.id === courseId)
  if (!course) return null

  return (
    <span className="chip course-chip">
      <span className="course-dot" style={{ background: course.color }} />
      {course.name}
    </span>
  )
}
