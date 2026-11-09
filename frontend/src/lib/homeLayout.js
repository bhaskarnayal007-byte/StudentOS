// The order and visibility of Home's islands, set in Settings. Laptops and
// phones keep separate layouts (they're designed differently), both stored in
// state.homeLayout so they follow the account. Plain JS for the node test.

/** Every island each layout can hold. 'octi' is Octi himself: on a laptop the
 *  middle column (islands before him go left, after him right); on a phone
 *  the Ask Octi bar. He can move but not be hidden. */
export const LABELS = {
  octi: 'Octi',
  tasks: 'Tasks',
  calendar: 'Calendar',
  courses: 'Courses',
  finance: 'Spending',
  friends: 'Friends',
  timer: 'Timer',
  schedule: "Today's schedule",
  notes: 'Notes',
  shortcuts: 'Shortcuts',
}

export const DEFAULTS = {
  wide: ['tasks', 'calendar', 'courses', 'finance', 'octi', 'friends', 'timer', 'schedule', 'notes', 'shortcuts'],
  // No Friends (a header button there) or Shortcuts (hidden on phones).
  phone: ['octi', 'tasks', 'schedule', 'calendar', 'timer', 'finance', 'notes', 'courses'],
}

/**
 * The layout to draw: the saved order for islands that still exist, then any
 * the save predates (new islands appear rather than vanish), never Octi hidden.
 */
export function resolve(saved, device) {
  const all = DEFAULTS[device]
  const order = (saved?.order ?? []).filter(id => all.includes(id))
  for (const id of all) if (!order.includes(id)) order.push(id)
  const hidden = (saved?.hidden ?? []).filter(id => all.includes(id) && id !== 'octi')
  return { order, hidden }
}

/** `order` with `id` moved one place up (-1) or down (+1). */
export function move(order, id, step) {
  const i = order.indexOf(id)
  const j = i + step
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Phones: two small islands next to each other share a row. */
const SMALL = ['timer', 'finance']
export function halves(order) {
  const out = new Set()
  for (let i = 0; i < order.length - 1; i++) {
    if (SMALL.includes(order[i]) && SMALL.includes(order[i + 1]) && !out.has(order[i])) {
      out.add(order[i])
      out.add(order[i + 1])
      i++
    }
  }
  return out
}
