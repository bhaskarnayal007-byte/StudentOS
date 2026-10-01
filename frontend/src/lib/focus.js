// The arithmetic behind the focus week, kept out of the component so it can be
// tested in node — which cannot import .jsx.

import { WEEKDAYS } from '../dates.js'

/** Seven buckets ending today, including the empty ones — a missing day is
 *  information, so the week must not silently close up around it. */
export function lastSevenDays(sessions, now = new Date()) {
  const out = []

  for (let back = 6; back >= 0; back--) {
    const day = new Date(now)
    day.setDate(day.getDate() - back)
    day.setHours(0, 0, 0, 0)
    const end = day.getTime() + 86_400_000

    out.push({
      key: day.toISOString().slice(0, 10),
      label: WEEKDAYS[day.getDay()],
      minutes: sessions
        .filter(s => s.endedAt >= day.getTime() && s.endedAt < end)
        .reduce((sum, s) => sum + s.minutes, 0),
    })
  }

  return out
}

export function formatSpan(minutes) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
