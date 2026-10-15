// Date handling, kept in one place.
//
// THE RULE: a calendar day is stored as the string "YYYY-MM-DD", never as a
// Date object or a timestamp. A Date is a precise *moment*; "the 5th" is not a
// moment, it's a label. Mixing them is where timezone bugs come from — store
// a moment and someone in another timezone sees the day before.

// Date object → "2026-09-05" using LOCAL time.
// (Do NOT use toISOString() here — it converts to UTC and can shift the day.)
export function toKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export const todayKey = () => toKey(new Date())

// Everything a month grid needs to draw itself.
export function monthGrid(year, month) {
  // Day 0 of the *next* month = the last day of this one. Handles leap years free.
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // How many blank cells before the 1st, so it lands under the right weekday.
  const blanks = new Date(year, month, 1).getDay() // 0 = Sunday
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1)
    return { day: i + 1, key: toKey(date) }
  })
  // The tail of last month and the head of next, so the grid is whole weeks.
  const prevDays = Array.from({ length: blanks }, (_, i) => {
    const date = new Date(year, month, i - blanks + 1)
    return { day: date.getDate(), key: toKey(date) }
  })
  const trailing = (7 - ((blanks + daysInMonth) % 7)) % 7
  const nextDays = Array.from({ length: trailing }, (_, i) => {
    const date = new Date(year, month + 1, i + 1)
    return { day: i + 1, key: toKey(date) }
  })
  return { blanks, days, prevDays, nextDays }
}

// The seven days (Sunday first) of the week containing `date`.
export function weekDays(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date: d, day: d.getDate(), key: toKey(d) }
  })
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
