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
  return { blanks, days }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
