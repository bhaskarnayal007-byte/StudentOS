import { todayKey } from '../dates.js'

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
    case 'add_task':
      dispatch({
        type: 'add-task',
        task: { text: args.text, due: args.due || '', priority: args.priority || 'normal' },
      })
      return `Added task "${args.text}".`

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

// What the model is told before your message. Two jobs: tell it today's date
// (otherwise "tomorrow" is meaningless), and show it your current data so it
// can answer questions without calling a tool at all.
export function systemPrompt(state) {
  const summary = {
    today: todayKey(),
    now: new Date().toLocaleString(),
    tasks: state.tasks.map(t => ({ text: t.text, done: t.done, due: t.due, priority: t.priority })),
    events: state.events.map(e => ({ title: e.title, date: e.date, time: e.time })),
    schedule: state.scheduleBlocks.map(b => ({
      title: b.title, day: b.day, from: b.startHour, to: b.endHour,
    })),
    alarms: state.alarms.map(a => ({ label: a.label, at: new Date(a.at).toLocaleString(), fired: a.fired })),
    timerRunning: Boolean(state.timer),
  }

  return [
    "You are the assistant inside Student OS, the user's personal planner.",
    'Use the tools to change their data. Answer questions directly from the',
    'context below without calling a tool. Weekday numbers are 0=Sunday..6=Saturday.',
    'Resolve relative dates like "tomorrow" against today\'s date. Be brief —',
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
