import { useState } from 'react'
import { useStore } from '../store.jsx'
import { WEEKDAYS } from '../dates.js'

// The visible window of the day. Change these two numbers and the whole grid
// resizes — nothing else needs editing.
const START_HOUR = 6
const END_HOUR = 23

// Category colours for blocks. These are user data, not theme tokens — but
// they're picked to sit alongside the forest/sage palette rather than fight it.
const COLORS = ['#2E5334', '#5C6E4A', '#7A6A4F', '#3F5A63', '#6B4F3F', '#4A5240']

export default function Schedule() {
  const { state, dispatch } = useStore()
  const [form, setForm] = useState({ title: '', day: 1, startHour: 9, endHour: 10, color: COLORS[0] })

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    // Numbers come out of <select> as strings — convert before storing, or
    // later arithmetic silently does "9" + 1 = "91".
    dispatch({
      type: 'add-block',
      block: {
        title: form.title.trim(),
        day: Number(form.day),
        startHour: Number(form.startHour),
        endHour: Math.max(Number(form.endHour), Number(form.startHour) + 1),
        color: form.color,
      },
    })
    set('title', '')
  }

  return (
    <div>
      <form className="row" onSubmit={submit}>
        <input
          className="grow"
          placeholder="e.g. Gym"
          value={form.title}
          onChange={e => set('title', e.target.value)}
        />
        <select value={form.day} onChange={e => set('day', e.target.value)}>
          {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
        </select>
        <select value={form.startHour} onChange={e => set('startHour', e.target.value)}>
          {hours.map(h => <option key={h} value={h}>{label(h)}</option>)}
        </select>
        <span className="muted">to</span>
        <select value={form.endHour} onChange={e => set('endHour', e.target.value)}>
          {hours.slice(1).concat(END_HOUR).map(h => <option key={h} value={h}>{label(h)}</option>)}
        </select>
        <button className="primary">Add</button>
      </form>

      <div className="sched-scroll">
        {/* One CSS Grid: column 1 = hour labels, columns 2-8 = the week.
            Row 1 = day headers, then one row per hour. */}
        <div
          className="sched"
          style={{ gridTemplateRows: `28px repeat(${hours.length}, 34px)` }}
        >
          <div className="sched-corner" />
          {WEEKDAYS.map((w, i) => (
            <div key={w} className="sched-dayhead" style={{ gridColumn: i + 2, gridRow: 1 }}>
              {w}
            </div>
          ))}

          {hours.map((h, i) => (
            <div key={h} className="sched-hour" style={{ gridColumn: 1, gridRow: i + 2 }}>
              {label(h)}
            </div>
          ))}

          {/* Empty cells, purely for the grid lines you see. */}
          {hours.map((h, i) =>
            WEEKDAYS.map((_, d) => (
              <div key={`${h}-${d}`} className="sched-cell" style={{ gridColumn: d + 2, gridRow: i + 2 }} />
            )),
          )}

          {/* The blocks. `grid-row: A / B` spans rows — that's what makes a
              2-hour block twice as tall, with no height calculation at all. */}
          {state.scheduleBlocks.map(b => (
            <button
              key={b.id}
              className="sched-block"
              title="Click to remove"
              onClick={() => dispatch({ type: 'delete-block', id: b.id })}
              style={{
                gridColumn: b.day + 2,
                gridRow: `${b.startHour - START_HOUR + 2} / ${b.endHour - START_HOUR + 2}`,
                background: b.color,
              }}
            >
              {b.title}
            </button>
          ))}
        </div>
      </div>

      {state.scheduleBlocks.length === 0 && (
        <p className="placeholder">No routine yet. Add a recurring block above.</p>
      )}
    </div>
  )
}

// 9 → "9 AM", 13 → "1 PM"
function label(h) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour} ${suffix}`
}
