import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { MONTH_NAMES, WEEKDAYS, monthGrid, todayKey, toKey, weekDays } from '../dates.js'
import useGoogleCalendar from '../lib/useGoogleCalendar.js'
import ShareButton from './ShareButton.jsx'

const GOOGLE_COLOR = '#5B7FBF'
// The week view's visible day. Earlier and later items are pinned to the edges.
const FIRST_HOUR = 7
const LAST_HOUR = 23
const HOUR_PX = 48

const fromKey = key => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toHours = t => {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

export default function Calendar() {
  const { state, dispatch } = useStore()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(todayKey())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const grid = monthGrid(year, month)
  const week = weekDays(cursor)

  const range = view === 'month'
    ? [(grid.prevDays[0] ?? grid.days[0]).key, (grid.nextDays.at(-1) ?? grid.days.at(-1)).key]
    : [week[0].key, week[6].key]
  const google = useGoogleCalendar(range[0], range[1])

  // Everything on the calendar, in one shape, grouped by day.
  const byDay = useMemo(() => {
    const color = Object.fromEntries(state.courses.map(c => [c.id, c.color]))
    const all = [
      ...state.events.map(e => ({ ...e, source: 'event', color: 'var(--color-accent)' })),
      ...state.tasks.filter(t => t.due).map(t => ({
        id: t.id, date: t.due, time: '', title: t.text, done: t.done,
        source: 'task', color: color[t.courseId] || 'var(--color-text-3)',
      })),
      ...google.events.map(e => ({ ...e, color: GOOGLE_COLOR })),
    ]
    const map = {}
    for (const item of all) (map[item.date] ??= []).push(item)
    // Untimed first, then by start time.
    for (const list of Object.values(map)) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    return map
  }, [state.events, state.tasks, state.courses, google.events])

  function shift(by) {
    setCursor(c => view === 'month'
      ? new Date(c.getFullYear(), c.getMonth() + by, 1)
      : new Date(c.getFullYear(), c.getMonth(), c.getDate() + by * 7))
  }
  function goToday() {
    setCursor(new Date())
    setSelected(todayKey())
  }
  function select(key) {
    setSelected(key)
    // Picking a faded day from a neighbouring month moves the view there.
    if (view === 'month' && fromKey(key).getMonth() !== month) setCursor(fromKey(key))
  }

  const title = view === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : weekTitle(week[0].date, week[6].date)

  return (
    <div className="calendar">
      <div className="cal-main">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button className="cal-arrow" onClick={() => shift(-1)} aria-label={`Previous ${view}`}>‹</button>
            <button className="cal-arrow" onClick={() => shift(1)} aria-label={`Next ${view}`}>›</button>
            <h2 className="cal-title">{title}</h2>
          </div>
          <div className="cal-actions">
            <button className="cal-today" onClick={goToday}>Today</button>
            <div className="cal-switch" role="group" aria-label="Calendar view">
              {['month', 'week'].map(v => (
                <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                  {v === 'month' ? 'Month' : 'Week'}
                </button>
              ))}
            </div>
            <GooglePill google={google} />
          </div>
        </div>
        {google.error && <p className="cal-error">{google.error}</p>}

        {view === 'month' ? (
          <MonthView grid={grid} byDay={byDay} selected={selected} onSelect={select} />
        ) : (
          <WeekView week={week} byDay={byDay} blocks={state.scheduleBlocks} selected={selected} onSelect={select} />
        )}
      </div>

      <DayDetail dateKey={selected} items={byDay[selected] || []} dispatch={dispatch} />
    </div>
  )
}

function GooglePill({ google }) {
  if (!google.available) return null
  if (google.status === 'connected') {
    return (
      <button className="cal-google on" onClick={google.disconnect} title="Disconnect Google Calendar">
        <span className="cal-google-dot" aria-hidden="true" /> Google
      </button>
    )
  }
  return (
    <button className="cal-google" onClick={google.connect}>
      {google.status === 'expired' ? 'Reconnect Google' : 'Connect Google Calendar'}
    </button>
  )
}

function MonthView({ grid, byDay, selected, onSelect }) {
  const today = todayKey()
  const cells = [
    ...grid.prevDays.map(d => ({ ...d, outside: true })),
    ...grid.days,
    ...grid.nextDays.map(d => ({ ...d, outside: true })),
  ]

  return (
    <div className="cal-month">
      {WEEKDAYS.map(w => <div key={w} className="cal-head">{w}</div>)}
      {cells.map(({ day, key, outside }, i) => {
        const items = byDay[key] || []
        const classes = ['cal-day']
        if (outside) classes.push('outside')
        if (i % 7 === 0 || i % 7 === 6) classes.push('weekend')
        if (key === selected) classes.push('selected')
        if (key === today) classes.push('today')
        return (
          <button key={key} className={classes.join(' ')} onClick={() => onSelect(key)}
            aria-label={`${fromKey(key).toDateString()}, ${items.length} item${items.length === 1 ? '' : 's'}`}>
            <span className="cal-num">{day}</span>
            <span className="cal-chips">
              {items.slice(0, 3).map(it => (
                <span key={it.id} className={`cal-chip${it.done ? ' done' : ''}`} style={{ '--c': it.color }}>
                  {it.time && <b>{it.time}</b>} {it.title}
                </span>
              ))}
              {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WeekView({ week, byDay, blocks, selected, onSelect }) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i)
  const now = useNow()
  const today = toKey(now)
  const clamp = h => Math.min(Math.max(h, FIRST_HOUR), LAST_HOUR)
  const y = h => (clamp(h) - FIRST_HOUR) * HOUR_PX

  return (
    <div className="cal-week">
      <div className="cal-week-head">
        <span />
        {week.map(({ key, day, date }) => (
          <button key={key} onClick={() => onSelect(key)}
            className={`cal-week-day${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}`}>
            <small>{WEEKDAYS[date.getDay()]}</small>
            <span className="cal-num">{day}</span>
          </button>
        ))}
      </div>

      {/* Tasks, untimed events and Google all-day events. */}
      <div className="cal-allday">
        <span className="cal-allday-label">All day</span>
        {week.map(({ key }) => (
          <div key={key}>
            {(byDay[key] || []).filter(it => !it.time).map(it => (
              <span key={it.id} className={`cal-chip${it.done ? ' done' : ''}`} style={{ '--c': it.color }}>{it.title}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="cal-week-scroll">
        <div className="cal-week-body" style={{ height: hours.length * HOUR_PX }}>
          <div className="cal-hours">
            {hours.map(h => <span key={h} style={{ top: y(h) }}>{String(h).padStart(2, '0')}:00</span>)}
          </div>
          {week.map(({ key, date }) => (
            <div key={key} className="cal-col" onClick={() => onSelect(key)}>
              {/* The weekly timetable, as soft background blocks. */}
              {blocks.filter(b => b.day === date.getDay()).map(b => (
                <div key={b.id} className="cal-block" style={{ top: y(b.startHour), height: y(b.endHour) - y(b.startHour), '--c': b.color }}>
                  {b.title}
                </div>
              ))}
              {(byDay[key] || []).filter(it => it.time).map(it => {
                const start = toHours(it.time)
                const end = toHours(it.endTime) ?? start + 1
                return (
                  <div key={it.id} className="cal-event" style={{ top: y(start), height: Math.max(y(end) - y(start), 22), '--c': it.color }}>
                    <b>{it.time}</b> {it.title}
                  </div>
                )
              })}
              {key === today && now.getHours() >= FIRST_HOUR && now.getHours() < LAST_HOUR && (
                <div className="cal-now" style={{ top: y(now.getHours() + now.getMinutes() / 60) }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The current time, ticking each minute, for the week view's "now" line. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// The selected day: an agenda, plus a form to add an event.
function DayDetail({ dateKey, items, dispatch }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    dispatch({ type: 'add-event', event: { date: dateKey, time, title: title.trim() } })
    setTitle('')
    setTime('')
  }

  return (
    <aside className="day-detail">
      <p className="day-detail-kicker">{dateKey === todayKey() ? 'Today' : fromKey(dateKey).toLocaleDateString(undefined, { weekday: 'long' })}</p>
      <h3>{fromKey(dateKey).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>

      <form className="day-add" onSubmit={submit}>
        <input placeholder="Add an event" value={title} onChange={e => setTitle(e.target.value)} aria-label="Event title" />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Event time" />
        <button className="primary">Add</button>
      </form>

      {items.length === 0 ? (
        <p className="day-empty">Nothing planned. Enjoy the free day.</p>
      ) : (
        <ul className="agenda">
          {items.map(it => (
            <li key={it.id} className={`agenda-item${it.done ? ' done' : ''}`} style={{ '--c': it.color }}>
              <span className="agenda-time">
                {it.time ? <>{it.time}{it.endTime && <small>{it.endTime}</small>}</> : 'All day'}
              </span>
              <span className="agenda-body">
                {it.link
                  ? <a href={it.link} target="_blank" rel="noreferrer">{it.title}</a>
                  : <span>{it.title}</span>}
                <small>{it.source === 'google' ? 'Google Calendar' : it.source}</small>
              </span>
              {it.source === 'event' && <ShareButton kind="event" item={it} />}
              {it.source === 'event' && (
                <button className="ghost" onClick={() => dispatch({ type: 'delete-event', id: it.id })} aria-label={`Delete ${it.title}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function weekTitle(a, b) {
  const sameMonth = a.getMonth() === b.getMonth()
  const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const right = b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${left} – ${right} ${b.getFullYear()}`
}
