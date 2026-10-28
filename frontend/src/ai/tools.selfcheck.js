// Self-check for the state message and read_note. Run it with:
//
//   node frontend/src/ai/tools.selfcheck.js
//
// It exists because the state message is trimmed hard for token cost, and
// every cut is a thing that can silently stop working: a filter that drops the
// wrong tasks, a truncation that hides a note's title, a total that sums the
// wrong month, a table whose columns drift out of step with its header. All of
// those still look fine in the UI — the assistant just quietly gets worse.
// No framework on purpose; assert is enough.
import assert from 'node:assert/strict'
import { stateMessage, systemPrompt, runTool, outline } from './tools.js'
import { todayKey } from '../dates.js'

const LONG = 'Enthalpy lecture: H = U + PV. '.repeat(20)
const month = todayKey().slice(0, 7)
const state = {
  courses: [{ id: 'c0', name: 'Chemistry' }, { id: 'c1', name: 'Calculus' }],
  topics: [
    // A learned topic that is still a parent: must survive, so add_topics can
    // name it. Its learned leaf child must not.
    { id: 't0', courseId: 'c0', parentId: null, text: 'Thermodynamics', done: true },
    { id: 't1', courseId: 'c0', parentId: 't0', text: 'Enthalpy', done: true },
    { id: 't2', courseId: 'c0', parentId: 't0', text: 'Entropy', done: false },
    { id: 't3', courseId: 'c0', parentId: null, text: 'Kinetics', done: false },
  ],
  notes: [{ id: 'n0', courseId: 'c0', text: LONG }],
  tasks: [
    { id: 'k0', courseId: 'c0', text: 'read ch 4', done: false, due: '2026-11-02', priority: 'high' },
    { id: 'k1', courseId: 'c0', text: 'lab report', done: true },
    // A comma in the text: it must not read as a column break.
    { id: 'k2', courseId: 'c1', text: 'buy milk, eggs', done: false },
  ],
  events: [
    { id: 'e0', title: 'Past lecture', date: '2020-01-01', time: '09:00' },
    { id: 'e1', title: 'Today seminar', date: todayKey(), time: '14:00' },
    { id: 'e2', title: 'Future exam', date: '2099-01-01', time: '10:00' },
  ],
  scheduleBlocks: [{ id: 's0', title: 'Chem study', day: 3, startHour: 9, endHour: 11 }],
  alarms: [],
  timer: null,
  expenses: [
    { id: 'x0', amount: 120, category: 'food', date: `${month}-01`, note: 'canteen' },
    { id: 'x1', amount: 400, category: 'books', date: `${month}-02`, note: 'lab manual' },
    { id: 'x2', amount: 60, category: 'food', date: `${month}-03`, note: 'tea' },
    { id: 'x3', amount: 999, category: 'food', date: '2020-01-01', note: 'last year' },
  ],
}

const msg = stateMessage(state)
const header = JSON.parse(msg.slice(msg.indexOf('{'), msg.indexOf('\n\n')))

// ── the static half must stay static ────────────────────────────────────────
// Anything live in it costs the whole prefix, which is what the split exists
// to protect.
assert.equal(systemPrompt(), systemPrompt(), 'systemPrompt must be identical across calls')
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(systemPrompt()), 'systemPrompt must carry no date')

// ── tables ──────────────────────────────────────────────────────────────────
/** Rows of a labelled block, as arrays of cells. */
function rowsOf(label) {
  const block = msg.split('\n\n').find(b => b.startsWith(label))
  if (!block) return []
  return block.split('\n').slice(1).map(line => line.split(' | '))
}

const tasks = rowsOf('Tasks pending')
assert.equal(tasks.length, 2, 'only unfinished tasks belong in the table')
assert.deepEqual(tasks[0], ['read ch 4', '2026-11-02', 'high', 'Chemistry'])
assert.ok(!msg.includes('lab report'), 'a finished task must not be listed')
assert.equal(header.tasksCompleted, 1, 'finished tasks must still be counted')
// A comma inside a cell must not create a column.
assert.equal(tasks[1].length, 4, 'a comma in a task name must not split the row')
assert.equal(tasks[1][0], 'buy milk, eggs')
// Every row must have exactly as many cells as the header names.
for (const [label, n] of [['Tasks pending', 4], ['Events', 3], ['Weekly schedule', 4], ['Notes', 2]]) {
  for (const row of rowsOf(label)) {
    assert.equal(row.length, n, `${label}: a row has ${row.length} cells, header names ${n}`)
  }
}

// ── events: today and later only ────────────────────────────────────────────
const events = rowsOf('Events').map(r => r[0])
assert.ok(events.includes('Today seminar'), "today's events must be kept")
assert.ok(events.includes('Future exam'), 'future events must be kept')
assert.ok(!events.includes('Past lecture'), 'past events must be dropped')

// ── notes are previews, not bodies ──────────────────────────────────────────
const note = rowsOf('Notes (shortened — call read_note for the full text)')[0]
assert.ok(note[0].length < 110, 'note preview must stay short')
assert.ok(note[0].startsWith('Enthalpy lecture'), 'preview must keep the opening words')
assert.equal(note[1], 'Chemistry')
assert.ok(!msg.includes(LONG), 'the full note body must never be in the state message')

// ── expenses: this month, per category ──────────────────────────────────────
const byCat = Object.fromEntries(header.expensesThisMonth.map(e => [e.category, e.total]))
assert.equal(byCat.food, 180, 'food total must sum this month only (120 + 60)')
assert.equal(byCat.books, 400)
assert.ok(!msg.includes('canteen'), 'line-item notes must be gone')

// ── mind maps: learned leaves pruned, learned parents kept ──────────────────
const chem = header.mindMaps.Chemistry
const names = JSON.stringify(chem)
assert.ok(names.includes('Thermodynamics'), 'a learned topic with children must stay (add_topics parents)')
assert.ok(names.includes('Entropy'), 'an unlearned child must stay')
assert.ok(!names.includes('Enthalpy'), 'a learned leaf must be pruned')
assert.equal(header.topicsLearned, 2, 'learned topics must still be counted')
// The UI's own call must be unaffected by pruning.
assert.ok(
  JSON.stringify(outline(state.topics, 'c0')).includes('Enthalpy'),
  'outline() without prune must still return everything, for the UI',
)

// ── read_note is how a body is reached now ──────────────────────────────────
const ctx = { state, dispatch() {} }
assert.equal(runTool('read_note', { text: 'enthalpy' }, ctx), LONG, 'read_note must return the full body')
assert.match(runTool('read_note', { text: 'nope' }, ctx), /^No note matching/)
assert.equal(runTool('read_note', {}, ctx), 'Which note?')

// ── trimming must not break tools that match the user's own wording ─────────
let dispatched = null
runTool('complete_task', { text: 'ch 4' }, { state, dispatch: a => { dispatched = a } })
assert.deepEqual(dispatched, { type: 'toggle-task', id: 'k0' }, 'text matching must survive the trim')

console.log(`tools self-check passed (state message: ~${Math.ceil(msg.length / 4)} tokens for this fixture)`)
