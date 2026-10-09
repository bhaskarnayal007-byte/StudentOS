import { useState } from 'react'
import { useStore } from '../store.jsx'
import { MONTH_NAMES, WEEKDAYS, monthGrid, todayKey } from '../dates.js'

export default function Calendar() {
  const { state, dispatch } = useStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(todayKey())

  const { blanks, days } = monthGrid(year, month)

  // Step back/forward a month. Passing month = -1 or 12 to `new Date` is legal —
  // it rolls the year over for you, so no manual "if month > 11" logic.
  function shiftMonth(by) {
    const d = new Date(year, month + by, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  return (
    <div className="calendar">
      {/* The month and the selected day sit side by side on a wide screen. */}
      <div className="cal-month">
        <div className="row between">
          <button onClick={() => shiftMonth(-1)}>‹</button>
          <strong>{MONTH_NAMES[month]} {year}</strong>
          <button onClick={() => shiftMonth(1)}>›</button>
        </div>

        <div className="cal-grid">
          {WEEKDAYS.map(w => <div key={w} className="cal-head">{w}</div>)}

          {/* Empty cells so the 1st lands under the correct weekday. */}
          {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}

          {days.map(({ day, key }) => (
            <DayCell
              key={key}
              day={day}
              dateKey={key}
              selected={key === selected}
              onSelect={() => setSelected(key)}
            />
          ))}
        </div>
      </div>

      <DayDetail dateKey={selected} state={state} dispatch={dispatch} />
    </div>
  )
}

// One square in the grid. It asks the store what's on its day — this is the
// payoff of central state: tasks show on the calendar with no extra plumbing.
function DayCell({ day, dateKey, selected, onSelect }) {
  const { state } = useStore()
  const count =
    state.events.filter(e => e.date === dateKey).length +
    state.tasks.filter(t => t.due === dateKey && !t.done).length

  const classes = ['cal-day']
  if (selected) classes.push('selected')
  if (dateKey === todayKey()) classes.push('today')

  return (
    <button className={classes.join(' ')} onClick={onSelect}>
      <span>{day}</span>
      {count > 0 && <span className="dot">{count}</span>}
    </button>
  )
}

// The panel under the grid: what's on the selected day + a form to add an event.
function DayDetail({ dateKey, state, dispatch }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')

  const events = state.events
    .filter(e => e.date === dateKey)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const tasks = state.tasks.filter(t => t.due === dateKey)

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    dispatch({ type: 'add-event', event: { date: dateKey, time, title: title.trim() } })
    setTitle('')
    setTime('')
  }

  return (
    <div className="day-detail">
      <h3>{formatLong(dateKey)}</h3>

      <form className="row" onSubmit={submit}>
        <input
          className="grow"
          placeholder="Add an event"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        <button className="primary">Add</button>
      </form>

      {events.length === 0 && tasks.length === 0 && (
        <p className="placeholder">Nothing on this day.</p>
      )}

      <ul className="list">
        {events.map(ev => (
          <li key={ev.id} className="item">
            {ev.time && <span className="chip">{ev.time}</span>}
            <span className="grow">{ev.title}</span>
            <button className="ghost" onClick={() => dispatch({ type: 'delete-event', id: ev.id })}>
              ✕
            </button>
          </li>
        ))}

        {/* Tasks appear here read-only — they're owned by the Tasks tab. */}
        {tasks.map(t => (
          <li key={t.id} className={t.done ? 'item done' : 'item'}>
            <span className="chip">task</span>
            <span className="grow">{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatLong(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
