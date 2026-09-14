import { useState } from 'react'
import { useStore } from '../store.jsx'

export default function Tasks() {
  const { state, dispatch } = useStore()

  // Form fields are "controlled": the input shows `text`, and typing updates
  // `text`. The variable is the source of truth, not the DOM element.
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('normal')

  function submit(e) {
    e.preventDefault() // stop the browser from reloading the page
    if (!text.trim()) return
    dispatch({ type: 'add-task', task: { text: text.trim(), due, priority } })
    setText('')
    setDue('')
  }

  // Sort for display only — we never reorder the stored array itself.
  // Unfinished first, then by due date (tasks with no date sink to the bottom).
  const shown = [...state.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return (a.due || '9999').localeCompare(b.due || '9999')
  })

  return (
    <div>
      <form className="row" onSubmit={submit}>
        <input
          className="grow"
          placeholder="What needs doing?"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        {/* Native date picker — no library needed. */}
        <input type="date" value={due} onChange={e => setDue(e.target.value)} />
        <select value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <button className="primary">Add</button>
      </form>

      {shown.length === 0 && <p className="placeholder">Nothing yet. Add your first task.</p>}

      <ul className="list">
        {shown.map(task => (
          // `key` lets React track which <li> is which across redraws.
          <li key={task.id} className={task.done ? 'item done' : 'item'}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => dispatch({ type: 'toggle-task', id: task.id })}
            />
            <span className="grow">{task.text}</span>
            {task.priority !== 'normal' && <span className={`chip ${task.priority}`}>{task.priority}</span>}
            {task.due && <span className="chip">{formatDue(task.due)}</span>}
            <button className="ghost" onClick={() => dispatch({ type: 'delete-task', id: task.id })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// "2026-09-05" → "Sat, 5 Sep". Intl is built into the browser; no date library.
function formatDue(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
