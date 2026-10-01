import { todayKey, toKey } from '../dates.js'

// ─────────────────────────────────────────────────────────────────────────────
// THE TOOLS.
//
// This is the whole "AI can do things" trick, and there is no magic in it:
//
//   1. We describe our functions to the model as JSON (TOOL_DEFS below).
//   2. The model reads your message and replies "call add_task with {...}".
//   3. WE run the function. The model never touches your data.
//
// Every handler below dispatches exactly the same action your buttons
// dispatch. The assistant has no special powers — it just presses the buttons.
// Adding a new ability = one entry in TOOL_DEFS + one handler. Nothing else.
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a to-do item.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'What the task is.' },
          due: { type: 'string', description: 'Due date as YYYY-MM-DD. Omit if none.' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          course: { type: 'string', description: 'Name of an existing subject this belongs to. Omit if none fits.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark an existing task as done, found by its text.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete an existing task, found by its text.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_event',
      description: 'Add a one-off calendar event on a specific date.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: '24-hour HH:MM. Omit if all-day.' },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_schedule_block',
      description: 'Add a recurring weekly routine block, e.g. "gym every Monday 7-9am".',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          day: { type: 'integer', description: '0=Sunday through 6=Saturday' },
          startHour: { type: 'integer', description: '0-23' },
          endHour: { type: 'integer', description: '0-23, must be after startHour' },
        },
        required: ['title', 'day', 'startHour', 'endHour'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_alarm',
      description: 'Set an alarm for a specific date and time.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          datetime: { type: 'string', description: 'Local time as YYYY-MM-DDTHH:MM' },
        },
        required: ['label', 'datetime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_course',
      description: 'Add a subject the user is studying, e.g. "Organic Chemistry".',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Save a note. Use for anything the user wants kept, including a summary you just wrote.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          course: { type: 'string', description: 'Name of an existing subject to file it under. Omit if none fits.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: 'Record something the user spent money on.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount spent, in rupees.' },
          category: { type: 'string', description: 'e.g. Food, Travel, Books. Reuse an existing category when one fits.' },
          date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
          note: { type: 'string' },
        },
        required: ['amount', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_expense',
      description: 'Remove a recorded expense, found by its note or category.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_timer',
      description: 'Start a countdown timer for a number of minutes.',
      parameters: {
        type: 'object',
        properties: {
          minutes: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['minutes'],
      },
    },
  },
]

// Kept in step with the same list in Schedule.jsx.
const COLORS = ['#2E5334', '#5C6E4A', '#7A6A4F', '#3F5A63', '#6B4F3F', '#4A5240']

// Runs one tool call. Returns a short string that goes BACK to the model, so it
// knows whether it worked and can say something sensible to you.
export function runTool(name, args, { state, dispatch }) {
  switch (name) {
    case 'add_task': {
      // A course name the model invented must not create a dangling link, so
      // an unknown name simply means no subject rather than a new one.
      const course = findCourse(state.courses, args.course)
      dispatch({
        type: 'add-task',
        task: {
          text: args.text,
          due: args.due || '',
          priority: args.priority || 'normal',
          courseId: course?.id,
        },
      })
      return course
        ? `Added "${args.text}" under ${course.name}.`
        : `Added task "${args.text}".`
    }

    case 'complete_task': {
      const task = findTask(state.tasks, args.text)
      if (!task) return `No task matching "${args.text}".`
      if (task.done) return `"${task.text}" was already done.`
      dispatch({ type: 'toggle-task', id: task.id })
      return `Completed "${task.text}".`
    }

    case 'delete_task': {
      const task = findTask(state.tasks, args.text)
      if (!task) return `No task matching "${args.text}".`
      if (!confirmDestructive(`Delete the task "${task.text}"?`)) return 'The user declined.'
      dispatch({ type: 'delete-task', id: task.id })
      return `Deleted "${task.text}".`
    }

    case 'add_event':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date || '')) return 'Date must be YYYY-MM-DD.'
      dispatch({
        type: 'add-event',
        event: { title: args.title, date: args.date, time: args.time || '' },
      })
      return `Added "${args.title}" on ${args.date}.`

    case 'add_schedule_block': {
      const day = Number(args.day)
      const start = Number(args.startHour)
      const end = Number(args.endHour)
      if (!(day >= 0 && day <= 6)) return 'day must be 0-6.'
      if (!(end > start)) return 'endHour must be after startHour.'
      dispatch({
        type: 'add-block',
        block: {
          title: args.title,
          day,
          startHour: start,
          endHour: end,
          color: COLORS[state.scheduleBlocks.length % COLORS.length],
        },
      })
      return `Added "${args.title}" to the weekly schedule.`
    }

    case 'set_alarm': {
      const at = new Date(args.datetime).getTime()
      // The model can hallucinate a malformed date; catch it here rather than
      // storing NaN and having the alarm quietly never fire.
      if (Number.isNaN(at)) return `Couldn't read "${args.datetime}" as a date and time.`
      dispatch({ type: 'add-alarm', alarm: { at, label: args.label } })
      return `Alarm set for ${new Date(at).toLocaleString()}.`
    }

    case 'add_course': {
      const name = (args.name || '').trim()
      if (!name) return 'A subject needs a name.'
      const existing = findCourse(state.courses, name)
      if (existing) return `${existing.name} is already there.`
      dispatch({
        type: 'add-course',
        course: { name, color: COLORS[state.courses.length % COLORS.length] },
      })
      return `Added ${name}.`
    }

    case 'add_note': {
      const text = (args.text || '').trim()
      if (!text) return 'A note needs something in it.'
      const course = findCourse(state.courses, args.course)
      dispatch({ type: 'add-note', note: { text, courseId: course?.id } })
      return course ? `Saved a note under ${course.name}.` : 'Saved the note.'
    }

    case 'add_expense': {
      const amount = Number(args.amount)
      if (!(amount > 0)) return 'amount must be a positive number.'
      const date = args.date || todayKey()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date must be YYYY-MM-DD.'
      dispatch({
        type: 'add-expense',
        expense: { amount, category: args.category || 'Other', date, note: args.note || '' },
      })
      return `Recorded ${amount} on ${args.category || 'Other'} (${date}).`
    }

    case 'delete_expense': {
      const expense = findExpense(state.expenses, args.text)
      if (!expense) return `No expense matching "${args.text}".`
      const label = `${expense.amount} on ${expense.category}${expense.note ? ` (${expense.note})` : ''}`
      if (!confirmDestructive(`Delete the expense: ${label}?`)) return 'The user declined.'
      dispatch({ type: 'delete-expense', id: expense.id })
      return `Deleted ${label}.`
    }

    case 'start_timer': {
      const mins = Number(args.minutes)
      if (!(mins > 0)) return 'minutes must be a positive number.'
      dispatch({
        type: 'start-timer',
        endsAt: Date.now() + mins * 60_000,
        label: args.label || 'Timer',
      })
      return `Timer started for ${mins} minute${mins === 1 ? '' : 's'}.`
    }

    default:
      return `Unknown tool "${name}".`
  }
}

/**
 * Ask before anything that destroys data.
 *
 * A model that misreads "clear that" can otherwise delete something the user
 * never mentioned, and there is no undo. The browser's own dialog is used
 * deliberately: it cannot be missed, it blocks the tool until answered, and it
 * needs no state threaded through the chat UI to work.
 */
function confirmDestructive(question) {
  if (typeof window === 'undefined') return true
  return window.confirm(`Octi wants to: ${question}`)
}

// Same forgiving match as tasks: the model says "chem", the subject is
// "Organic Chemistry".
function findCourse(courses, name) {
  const q = (name || '').trim().toLowerCase()
  if (!q) return null
  return (
    courses.find(c => c.name.toLowerCase() === q) ||
    courses.find(c => c.name.toLowerCase().includes(q)) ||
    courses.find(c => q.includes(c.name.toLowerCase())) ||
    null
  )
}

// Expenses have no title, so match on the note first, then the category.
function findExpense(expenses, text) {
  const q = (text || '').trim().toLowerCase()
  if (!q) return null
  const has = (value) => (value || '').toLowerCase().includes(q)
  return (
    expenses.find(e => (e.note || '').toLowerCase() === q) ||
    expenses.find(e => has(e.note)) ||
    expenses.find(e => has(e.category)) ||
    null
  )
}

// The model refers to tasks by roughly what you called them, not by id.
// Exact match first, then "contains", so "milk" finds "Buy milk".
function findTask(tasks, text) {
  const q = (text || '').trim().toLowerCase()
  if (!q) return null
  return (
    tasks.find(t => t.text.toLowerCase() === q) ||
    tasks.find(t => t.text.toLowerCase().includes(q)) ||
    tasks.find(t => q.includes(t.text.toLowerCase())) ||
    null
  )
}

/** { Saturday: '2026-10-03', … } for the seven days after today, so "Friday"
 *  is a lookup rather than a calculation. */
function nextSevenDays() {
  const out = {}
  for (let i = 1; i <= 7; i++) {
    const day = new Date()
    day.setDate(day.getDate() + i)
    out[day.toLocaleDateString(undefined, { weekday: 'long' })] = toKey(day)
  }
  return out
}

// What the model is told before your message. Two jobs: tell it today's date
// (otherwise "tomorrow" is meaningless), and show it your current data so it
// can answer questions without calling a tool at all.
export function systemPrompt(state) {
  const summary = {
    today: todayKey(),
    now: new Date().toLocaleString(),
    // The model is given the weekday arithmetic rather than asked to do it.
    // Left to work out which date "Friday" is, it picked a Thursday — dates
    // are exactly the kind of reasoning it is worst at and we can do exactly.
    thisIs: new Date().toLocaleDateString(undefined, { weekday: 'long' }),
    nextSevenDays: nextSevenDays(),
    courses: state.courses.map(c => c.name),
    notes: state.notes.map(n => ({
      // Truncated: a term of notes in full would dominate every prompt and be
      // paid for on every message. Enough to find and summarise one.
      text: n.text.length > 400 ? `${n.text.slice(0, 400)}…` : n.text,
      course: state.courses.find(c => c.id === n.courseId)?.name,
    })),
    tasks: state.tasks.map(t => ({
      text: t.text,
      done: t.done,
      due: t.due,
      priority: t.priority,
      course: state.courses.find(c => c.id === t.courseId)?.name,
    })),
    events: state.events.map(e => ({ title: e.title, date: e.date, time: e.time })),
    schedule: state.scheduleBlocks.map(b => ({
      title: b.title, day: b.day, from: b.startHour, to: b.endHour,
    })),
    alarms: state.alarms.map(a => ({ label: a.label, at: new Date(a.at).toLocaleString(), fired: a.fired })),
    timerRunning: Boolean(state.timer),
    // Only this month's: the full history grows without limit and every token
    // of it is paid for on every message.
    expensesThisMonth: state.expenses
      .filter(e => e.date.slice(0, 7) === todayKey().slice(0, 7))
      .map(e => ({ amount: e.amount, category: e.category, date: e.date, note: e.note })),
  }

  return [
    "You are Octi, the octopus who runs Student OS — the user's personal planner.",
    'Be warm and short, never chirpy. You are a study partner, not a butler.',
    'Use the tools to change their data. Answer questions directly from the',
    'context below without calling a tool. Weekday numbers are 0=Sunday..6=Saturday.',
    'Resolve "tomorrow", "Friday" and the like by looking the date up in',
    'nextSevenDays below. Never work a weekday out yourself. Be brief —',
    'one or two sentences. Never invent data that is not below.',
    // The chat bubbles render plain text, so asking for plain text is cheaper
    // than shipping a Markdown renderer to un-render it.
    'Reply in plain text. No Markdown, no **bold**, no bullet characters —',
    'use short sentences or simple "-" lines.',
    '',
    'Current data:',
    JSON.stringify(summary),
  ].join('\n')
}
