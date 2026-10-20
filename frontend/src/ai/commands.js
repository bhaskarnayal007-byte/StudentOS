import { toKey } from '../dates.js'

// ─────────────────────────────────────────────────────────────────────────────
// THE FAST PATH. Common phrasings ("25 min timer", "spent 200 on food") are
// matched here and run straight through runTool, so they need no model, no
// network and no sign-in. Every pattern is anchored: a sentence that only
// looks like a command fails to match and goes to the AI as before.
// Adding a phrasing = one entry in TEMPLATES. Nothing else.
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY = `today|tomorrow|${DAYS.join('|')}`
const MINS = String.raw`(\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?)`

const TEMPLATES = [
  // "25 min timer", "set a 10 minute timer for laundry"
  {
    re: new RegExp(String.raw`^(?:start |set )?(?:an? )?${MINS}\s+timer(?:\s+for\s+(.+))?$`, 'i'),
    build: ([, minutes, label]) => ({ name: 'start_timer', args: { minutes: Number(minutes), label } }),
  },
  // "timer 25", "timer 10 min for tea"
  {
    re: /^(?:start |set )?(?:an? )?timer\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?)?(?:\s+for\s+(.+))?$/i,
    build: ([, minutes, label]) => ({ name: 'start_timer', args: { minutes: Number(minutes), label } }),
  },
  // "add task buy milk tomorrow", "todo: essay due friday"
  {
    re: new RegExp(String.raw`^(?:add (?:a )?task|todo|task)(?::\s*|\s+)(.+?)(?:\s+(?:due\s+|by\s+)?(${DAY}))?$`, 'i'),
    build: ([, text, day], now) => ({ name: 'add_task', args: { text, due: day ? resolveDay(day, now) : undefined } }),
  },
  // "done buy milk", "mark buy milk done", "complete task essay"
  {
    re: /^(?:(?:done:?|complete task)\s+(.+)|mark\s+(.+?)\s+(?:as\s+)?done)$/i,
    build: ([, a, b]) => ({ name: 'complete_task', args: { text: a || b } }),
  },
  // "alarm 7:30", "set an alarm at 7am tomorrow for gym"
  {
    re: new RegExp(String.raw`^(?:set (?:an? )?)?alarm\s+(?:at\s+|for\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(${DAY}))?(?:\s+(?:for\s+)?(.+))?$`, 'i'),
    build: ([, h, m = '00', ampm, day, label], now) => {
      let hour = Number(h)
      if (ampm) {
        if (hour < 1 || hour > 12) return null
        hour = (hour % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0)
      }
      if (hour > 23 || Number(m) > 59) return null
      const time = `${String(hour).padStart(2, '0')}:${m}`
      // No day given: the next time the clock reads that, today or tomorrow.
      let date = day ? resolveDay(day, now) : toKey(now)
      if (!day && new Date(`${date}T${time}`) <= now) date = resolveDay('tomorrow', now)
      return { name: 'set_alarm', args: { datetime: `${date}T${time}`, label: label || 'Alarm' } }
    },
  },
  // "spent 200 on food", "₹150 travel", "rs 90 on coffee"
  {
    re: /^(?:spent\s+(?:₹|rs\.?\s*)?|(?:₹|rs\.?\s*))(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+)$/i,
    build: ([, amount, category]) => ({
      name: 'add_expense',
      args: { amount: Number(amount), category: category[0].toUpperCase() + category.slice(1) },
    }),
  },
  // "note: remember the lab coat"
  {
    re: /^note:\s*([\s\S]+)$/i,
    build: ([, text]) => ({ name: 'add_note', args: { text } }),
  },
  // "add subject Organic Chemistry"
  {
    re: /^add (?:subject|course)(?::\s*|\s+)(.+)$/i,
    build: ([, name]) => ({ name: 'add_course', args: { name } }),
  },
]

/** `{ name, args }` for runTool when the text is a known command, else null. */
export function matchCommand(text, now = new Date()) {
  const input = (text || '').trim().replace(/[.!]+$/, '')
  for (const { re, build } of TEMPLATES) {
    const m = input.match(re)
    if (m) return build(m, now)
  }
  return null
}

// Same meaning the AI is given in nextSevenDays: a weekday is the next one
// after today, never today itself.
function resolveDay(word, now) {
  const w = word.toLowerCase()
  const day = new Date(now)
  if (w === 'tomorrow') day.setDate(day.getDate() + 1)
  else if (w !== 'today') day.setDate(day.getDate() + (((DAYS.indexOf(w) - day.getDay() + 6) % 7) + 1))
  return toKey(day)
}
