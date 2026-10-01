import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useNow, beep } from '../useNow.js'
import FocusWeek from './FocusWeek.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// THE RULE FOR TIME: store the moment it ENDS, never "seconds remaining".
//
// If you store a countdown you have to decrement it, and the moment the browser
// throttles your tab (minimised, phone locked, laptop asleep) the count falls
// behind and your timer is silently wrong. Store `endsAt` and the remaining
// time is always `endsAt - Date.now()` — correct no matter what happened in
// between, even across a page reload.
// ─────────────────────────────────────────────────────────────────────────────

export default function Timers() {
  const { state, dispatch } = useStore()
  const now = useNow() // re-renders this component once a second

  return (
    <div className="stack">
      <TimerPanel state={state} dispatch={dispatch} now={now} />
      <hr className="sep" />
      {/* Directly under the timer: the reason to start another one. */}
      <FocusWeek />
      <hr className="sep" />
      <AlarmPanel state={state} dispatch={dispatch} now={now} />
    </div>
  )
}

// ─── Countdown timer ─────────────────────────────────────────────────────────
function TimerPanel({ state, dispatch, now }) {
  const [minutes, setMinutes] = useState(10)
  const [label, setLabel] = useState('')

  const timer = state.timer
  // `now` from useNow is what makes this component re-render each second, but
  // it can be up to a second stale — reading the clock again here keeps the
  // first frame from showing 5:01 for a 5-minute timer.
  const remaining = timer ? timer.endsAt - Date.now() : 0
  const done = timer && remaining <= 0

  function start(e) {
    e.preventDefault()
    requestNotificationPermission()
    dispatch({
      type: 'start-timer',
      endsAt: Date.now() + Number(minutes) * 60_000,
      label: label.trim() || 'Timer',
    })
  }

  return (
    <section>
      <h3>Timer</h3>

      {!timer && (
        <form className="row" onSubmit={start}>
          <input
            className="grow"
            placeholder="What for? (optional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <input
            type="number"
            min="1"
            max="600"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            style={{ width: 80 }}
          />
          <span className="muted">min</span>
          <button className="primary">Start</button>
        </form>
      )}

      {timer && (
        <div className={done ? 'countdown finished' : 'countdown'}>
          <div className="big">{formatRemaining(remaining)}</div>
          <div className="muted">{done ? `${timer.label} — time's up` : timer.label}</div>
          <button onClick={() => dispatch({ type: 'clear-timer' })}>
            {done ? 'Dismiss' : 'Cancel'}
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Alarms ──────────────────────────────────────────────────────────────────
function AlarmPanel({ state, dispatch, now }) {
  const [when, setWhen] = useState('')
  const [label, setLabel] = useState('')

  function add(e) {
    e.preventDefault()
    if (!when) return
    requestNotificationPermission()
    // <input type="datetime-local"> gives "2026-09-03T14:30" in LOCAL time.
    // `new Date(...)` on that string parses it as local — which is what we want.
    dispatch({ type: 'add-alarm', alarm: { at: new Date(when).getTime(), label: label.trim() || 'Alarm' } })
    setWhen('')
    setLabel('')
  }

  const sorted = [...state.alarms].sort((a, b) => a.at - b.at)

  return (
    <section>
      <h3>Alarms</h3>

      <form className="row" onSubmit={add}>
        <input
          className="grow"
          placeholder="Label"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
        <button className="primary">Set</button>
      </form>

      {sorted.length === 0 && <p className="placeholder">No alarms set.</p>}

      <ul className="list">
        {sorted.map(a => (
          <li key={a.id} className={a.fired ? 'item done' : 'item'}>
            <span className="grow">{a.label}</span>
            <span className="chip">{new Date(a.at).toLocaleString(undefined, {
              weekday: 'short', hour: 'numeric', minute: '2-digit',
            })}</span>
            {a.fired && <span className="chip">rang</span>}
            <button className="ghost" onClick={() => dispatch({ type: 'delete-alarm', id: a.id })}>✕</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── The watcher ─────────────────────────────────────────────────────────────
// Mounted once in App.jsx, so alarms ring no matter which tab you're looking at.
// It draws nothing — it only watches the clock.
//
// Note this is an EFFECT, not render code. Beeping and dispatching are "side
// effects": they change the world outside React. Doing them during render is
// the classic React bug (double-fires in StrictMode, warns in the console).
export function AlarmWatcher() {
  const { state, dispatch } = useStore()
  const now = useNow()
  const timerRang = useRef(false)

  const due = state.alarms.filter(a => !a.fired && a.at <= now)
  const dueIds = due.map(a => a.id).join(',')

  useEffect(() => {
    if (due.length === 0) return
    alert_(due.map(a => a.label).join(', '))
    dispatch({ type: 'fire-alarms', ids: due.map(a => a.id) })
    // Depend on the id list, not the array — a new array every render would
    // re-run this effect forever.
  }, [dueIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const timerDone = state.timer && state.timer.endsAt <= now
  useEffect(() => {
    if (!timerDone) {
      timerRang.current = false // reset so the next timer can ring
      return
    }
    if (timerRang.current) return
    timerRang.current = true
    alert_(`${state.timer.label} finished`)

    // A timer that ran its course is a focus session. Cancelling one isn't,
    // which is why this lives here and not in clear-timer.
    const { startedAt, endsAt } = state.timer
    const minutes = Math.round(((endsAt - (startedAt ?? endsAt)) / 60_000))
    // Older timers have no startedAt, and a sub-minute run isn't worth a row.
    if (minutes >= 1) dispatch({ type: 'log-focus', endedAt: endsAt, minutes })
  }, [timerDone]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function alert_(label) {
  beep()
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Student OS', { body: label, icon: '/pwa-192.png' })
  }
}

function requestNotificationPermission() {
  // Asked on first use, not on page load — browsers ignore (and users hate)
  // permission prompts that appear before any interaction.
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
