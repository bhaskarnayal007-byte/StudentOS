import { useStore } from '../store.jsx'
import { lastSevenDays, formatSpan } from '../lib/focus.js'

export { formatSpan }

/**
 * Hours focused, last seven days.
 *
 * Plain divs rather than a chart library: seven bars with no axes, legend or
 * tooltip is less code than configuring a chart to hide all three, and it
 * inherits the theme for free.
 */
export default function FocusWeek() {
  const { state } = useStore()
  const days = lastSevenDays(state.focusSessions)
  const most = Math.max(...days.map(d => d.minutes), 1)
  const total = days.reduce((sum, d) => sum + d.minutes, 0)

  return (
    <section className="focus-week">
      <header className="widget-head">
        <h3>Focus</h3>
        <span className="muted">{formatSpan(total)} this week</span>
      </header>

      {total === 0 ? (
        <p className="placeholder">
          No sessions yet. A timer that runs to the end counts as one.
        </p>
      ) : (
        <ol className="focus-bars">
          {days.map(day => (
            <li key={day.key}>
              {/* The bar is the value; the title carries the exact figure so
                  it isn't lost to anyone reading the shape alone. */}
              <span
                className="focus-bar"
                style={{ height: `${Math.round((day.minutes / most) * 100)}%` }}
                title={`${day.label}: ${formatSpan(day.minutes)}`}
              />
              <span className="focus-day">{day.label}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
