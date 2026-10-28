import { todayKey, toKey } from '../dates.js'
import { descendants } from '../lib/topics.js'

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
      description: 'Save a note. Use for anything the user wants kept, including a summary you just wrote. Not for topics or a mind map — use add_topics for those.',
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
      name: 'read_note',
      description:
        'Read one note in full. The notes in your context are shortened to their first line, ' +
        'so call this before summarising, quoting or answering a question about what a note says.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Words from the note, or its subject.' },
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
      name: 'add_topics',
      description:
        "Add topics to a subject's mind map, optionally with nested sub-topics, in one call. " +
        'Use this for "topics", "sub-topics", "syllabus", "mind map" or "what I need to learn". ' +
        'Send a whole branch at once (topics with their subtopics) rather than one call per topic. ' +
        'To add sub-topics under a topic that already exists, give its name as parent.',
      parameters: {
        type: 'object',
        properties: {
          course: { type: 'string', description: 'Name of an existing subject.' },
          parent: { type: 'string', description: 'Existing topic to add under. Omit to add directly under the subject.' },
          topics: { type: 'array', items: topicSchema(3) },
        },
        required: ['course', 'topics'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_topic_learned',
      description: "Tick a mind-map topic as learned (or untick it with learned: false).",
      parameters: {
        type: 'object',
        properties: {
          course: { type: 'string' },
          topic: { type: 'string' },
          learned: { type: 'boolean' },
        },
        required: ['course', 'topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_topic',
      description: 'Delete a mind-map topic and everything under it. Only when the user clearly asks.',
      parameters: {
        type: 'object',
        properties: { course: { type: 'string' }, topic: { type: 'string' } },
        required: ['course', 'topic'],
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

// A topic with sub-topics, nested `depth` levels deep. Spelled out rather than
// a $ref, which not every model's tool-calling accepts.
function topicSchema(depth) {
  const props = { name: { type: 'string' } }
  if (depth > 1) props.subtopics = { type: 'array', items: topicSchema(depth - 1) }
  return { type: 'object', properties: props, required: ['name'] }
}

// Kept in step with the same list in Schedule.jsx.
export const COLORS = ['#2E5334', '#5C6E4A', '#7A6A4F', '#3F5A63', '#6B4F3F', '#4A5240']

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

    case 'read_note': {
      // findByText matches on a `text` field, which is exactly a note's shape,
      // so this needs no matcher of its own.
      const note = findByText(state.notes, args.text)
      if (!note) return args.text ? `No note matching "${args.text}".` : 'Which note?'
      return note.text
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

    case 'add_topics': {
      const course = findCourse(state.courses, args.course)
      if (!course) return `There's no subject called "${args.course}". Add it first, or pick one of: ${state.courses.map(c => c.name).join(', ') || 'none yet'}.`
      const mine = state.topics.filter(t => t.courseId === course.id)
      let parentId = null
      if (args.parent) {
        const parent = findByText(mine, args.parent)
        if (!parent) return `${course.name} has no topic called "${args.parent}".`
        parentId = parent.id
        if (parent.collapsed) dispatch({ type: 'update-topic', id: parent.id, changes: { collapsed: false } })
      }

      // Ids are made here, not read back from state, so a sub-topic can point
      // at the topic added a moment earlier in this same call. State only
      // refreshes between the model's turns, not between dispatches.
      let added = 0
      const add = (list, under, depth) => {
        if (!Array.isArray(list) || depth > 6) return
        for (const item of list) {
          const text = (typeof item === 'string' ? item : item?.name || '').trim()
          if (!text) continue
          const id = crypto.randomUUID()
          dispatch({ type: 'add-topic', topic: { id, courseId: course.id, parentId: under, text: text.slice(0, 80) } })
          added++
          add(item?.subtopics, id, depth + 1)
        }
      }
      add(args.topics, parentId, 0)
      if (!added) return 'No topic names were given.'
      return `Added ${added} topic${added === 1 ? '' : 's'} to the ${course.name} mind map${args.parent ? ` under ${args.parent}` : ''}.`
    }

    case 'mark_topic_learned': {
      const course = findCourse(state.courses, args.course)
      if (!course) return `There's no subject called "${args.course}".`
      const topic = findByText(state.topics.filter(t => t.courseId === course.id), args.topic)
      if (!topic) return `${course.name} has no topic called "${args.topic}".`
      const learned = args.learned !== false
      dispatch({ type: 'update-topic', id: topic.id, changes: { done: learned } })
      return `Marked "${topic.text}" as ${learned ? 'learned' : 'not learned yet'}.`
    }

    case 'delete_topic': {
      const course = findCourse(state.courses, args.course)
      if (!course) return `There's no subject called "${args.course}".`
      const topic = findByText(state.topics.filter(t => t.courseId === course.id), args.topic)
      if (!topic) return `${course.name} has no topic called "${args.topic}".`
      const below = descendants(state.topics, topic.id).length
      const what = below ? `"${topic.text}" and its ${below} sub-topics` : `"${topic.text}"`
      if (!confirmDestructive(`delete ${what} from ${course.name}`)) return 'The user said no; nothing was deleted.'
      dispatch({ type: 'delete-topic', id: topic.id })
      return `Deleted ${what}.`
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
  return findByText(tasks, text)
}

// Shared by tasks and topics: anything with a `text` the model names loosely.
function findByText(items, text) {
  const q = (text || '').trim().toLowerCase()
  if (!q) return null
  return (
    items.find(t => t.text.toLowerCase() === q) ||
    items.find(t => t.text.toLowerCase().includes(q)) ||
    items.find(t => t.text && q.includes(t.text.toLowerCase())) ||
    null
  )
}

/** A subject's map as nested { name, learned, subtopics }, for the prompt. */
/** `prune` drops topics that are both learned and childless, for the copy sent
 *  to the model — a finished leaf answers no question worth its tokens. A
 *  learned topic with children is kept, so add_topics can still name it as a
 *  parent. The UI calls this without `prune` and sees everything. */
export function outline(topics, courseId, parentId = null, prune = false) {
  return topics
    .filter(t => t.courseId === courseId && t.parentId === parentId)
    .map(t => {
      const kids = outline(topics, courseId, t.id, prune)
      if (prune && t.done && !kids.length) return null
      const node = { name: t.text }
      if (t.done) node.learned = true
      if (kids.length) node.subtopics = kids
      return node
    })
    .filter(Boolean)
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

// The standing instructions, split out from the live data below.
//
// This was done for prompt caching — a provider caches by prefix, so a static
// block first should make repeat requests cheaper. Measured against Groq on
// 2026-10-28: it does not. `usage` carries no `prompt_tokens_details` and
// `prompt_tokens` is identical across repeat calls, so there is no cache and
// no discount to earn. The split is kept because it costs nothing and the two
// halves are genuinely different things, but do NOT count on a cache saving
// here. If a provider that reports cached tokens is added to AI_PROVIDERS,
// this ordering is already correct for it.
export function systemPrompt() {
  return [
    "You are Octi, the octopus who runs Student OS — the user's personal planner.",
    'Be warm and short, never chirpy. You are a study partner, not a butler.',
    'Use the tools to change their data. Answer questions directly from the',
    'data you are given without calling a tool. Weekday numbers are 0=Sunday..6=Saturday.',
    'Resolve "tomorrow", "Friday" and the like by looking the date up in',
    'nextSevenDays. Never work a weekday out yourself. Be brief —',
    'one or two sentences. Never invent data you were not given.',
    // The chat bubbles render plain text, so asking for plain text is cheaper
    // than shipping a Markdown renderer to un-render it.
    'Reply in plain text. No Markdown, no **bold**, no bullet characters —',
    'use short sentences or simple "-" lines.',
  ].join('\n')
}

/** A `header | row | row` block, or '' when there is nothing to list.
 *
 *  Lists go out as tables rather than JSON because JSON repeats every key on
 *  every row: 30 pending tasks spent a third of their tokens re-stating
 *  "text"/"due"/"priority"/"course". A table names each column once and loses
 *  nothing — measured 34% off tasks, 34% off events, 40% off the schedule.
 *  Pipes, not commas: a task called "milk, eggs" must not look like a column
 *  break. Empty cells are left empty rather than written as "null". */
function table(label, columns, rows, cells) {
  if (!rows.length) return ''
  const body = rows.map(r => cells(r).map(v => (v == null ? '' : String(v))).join(' | '))
  return [`${label} — ${columns.join(' | ')}`, ...body].join('\n')
}

// Today's date and the user's current data, sent as its own message AFTER the
// static instructions so it sits outside the cached prefix. Two jobs: tell the
// model today's date (otherwise "tomorrow" is meaningless), and show it your
// data so it can answer questions without calling a tool at all.
//
// Everything here is paid for on every one of the 8 agent rounds, so the shape
// is chosen for size: scalars in one header block, repetitive lists as tables,
// and only the hierarchical mind maps as JSON, where the nesting is the point.
export function stateMessage(state) {
  const courseName = id => state.courses.find(c => c.id === id)?.name
  const today = todayKey()

  const header = {
    today,
    // Minute precision, not second. The model has never needed the seconds,
    // and a block that changes less often is one a future caching provider
    // could match.
    now: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    // The model is given the weekday arithmetic rather than asked to do it.
    // Left to work out which date "Friday" is, it picked a Thursday — dates
    // are exactly the kind of reasoning it is worst at and we can do exactly.
    thisIs: new Date().toLocaleDateString(undefined, { weekday: 'long' }),
    nextSevenDays: nextSevenDays(),
    courses: state.courses.map(c => c.name),
    // Each subject's mind map, so "what's left in chem?" needs no tool call
    // and new sub-topics can name a parent that really exists. Learned LEAF
    // topics are dropped — "what's left" is the question actually asked, and a
    // finished leaf answers nothing. A learned topic that still has children
    // stays, because add_topics needs to be able to name it as a parent.
    mindMaps: Object.fromEntries(
      state.courses
        .map(c => [c.name, outline(state.topics || [], c.id, null, true)])
        .filter(([, map]) => map.length),
    ),
    topicsLearned: (state.topics || []).filter(t => t.done).length,
    tasksCompleted: state.tasks.filter(t => t.done).length,
    alarms: state.alarms.map(a => ({ label: a.label, at: new Date(a.at).toLocaleString(), fired: a.fired })),
    timerRunning: Boolean(state.timer),
    // This month's spending as per-category totals, not line items. Every
    // question actually asked of it ("how much on food?", "what have I spent?")
    // is answered by the total, while the line items cost ~840 tokens a
    // request. delete_expense still works: it matches the user's own wording
    // against the real expense list, not against this summary.
    expensesThisMonth: Object.entries(
      state.expenses
        .filter(e => e.date.slice(0, 7) === today.slice(0, 7))
        .reduce((acc, e) => {
          const key = e.category || 'Other'
          acc[key] = (acc[key] ?? 0) + Number(e.amount || 0)
          return acc
        }, {}),
    ).map(([category, total]) => ({ category, total })),
  }

  const blocks = [
    `Current data:\n${JSON.stringify(header)}`,

    // Only what is still outstanding. Finished tasks were a third of the list
    // and are almost never what a question is about; complete_task checks the
    // real state anyway, so it still answers "that was already done".
    table(
      'Tasks pending',
      ['task', 'due', 'priority', 'subject'],
      state.tasks.filter(t => !t.done),
      t => [t.text, t.due, t.priority, courseName(t.courseId)],
    ),

    // Past events are history the planner never asks about, and a term's worth
    // of them accumulates forever. Today's included: "what's on today" is one
    // of the commonest questions.
    table(
      'Events',
      ['event', 'date', 'time'],
      state.events.filter(e => !e.date || e.date >= today),
      e => [e.title, e.date, e.time],
    ),

    table(
      'Weekly schedule',
      ['block', 'day (0=Sunday)', 'from', 'to'],
      state.scheduleBlocks,
      b => [b.title, b.day, b.startHour, b.endHour],
    ),

    // A preview, not the note. At 400 characters each this was 40% of the
    // whole message — ~2,700 tokens for a term's notes, resent on every round,
    // to answer questions that almost never need a note's body. The opening
    // words are enough to say which note is which; read_note fetches the full
    // text on the rare turn that needs it.
    table(
      'Notes (shortened — call read_note for the full text)',
      ['note', 'subject'],
      state.notes,
      n => [n.text.length > 100 ? `${n.text.slice(0, 100)}…` : n.text, courseName(n.courseId)],
    ),
  ]

  return blocks.filter(Boolean).join('\n\n')
}
