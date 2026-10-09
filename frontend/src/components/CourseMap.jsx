import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { NODE_H, NODE_W, descendants, layout, progress } from '../lib/topics.js'

// Breathing room around the tree inside the scrollable canvas.
const PAD = 32

/**
 * A subject's mind map: the subject at the top, topics beneath it, sub-topics
 * beneath those. The tree lays itself out — you only ever add, rename, tick
 * off, fold and delete.
 */
export default function CourseMap() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(null)
  const course = state.courses.find(c => c.id === id)

  const tree = useMemo(() => layout(state.topics, id), [state.topics, id])
  const canvas = useRef(null)
  const rootX = tree.nodes.find(n => !n.topic)?.x ?? 0

  // A wide tree opens centred on the subject, not scrolled to its left edge.
  useEffect(() => {
    const el = canvas.current
    if (el) el.scrollLeft = rootX + PAD + NODE_W / 2 - el.clientWidth / 2
    // Once per subject (and once more when saved data arrives), not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, Boolean(course)])

  if (!course) {
    return (
      <p className="placeholder">
        That subject doesn’t exist any more. <Link to="/courses">Back to Courses</Link>
      </p>
    )
  }

  const mine = state.topics.filter(t => t.courseId === id)
  const done = mine.filter(t => t.done).length
  const at = new Map(tree.nodes.map(n => [n.topic ? n.topic.id : null, n]))

  function add(parentId) {
    const topicId = crypto.randomUUID()
    const parent = state.topics.find(t => t.id === parentId)
    // Adding under a folded branch would hide the new topic as it appears.
    if (parent?.collapsed) dispatch({ type: 'update-topic', id: parentId, changes: { collapsed: false } })
    dispatch({ type: 'add-topic', topic: { id: topicId, courseId: id, parentId, text: '' } })
    setEditing(topicId)
  }

  function remove(topic) {
    const below = descendants(state.topics, topic.id).length
    if (below && !window.confirm(`Delete “${topic.text}” and its ${below} sub-topic${below === 1 ? '' : 's'}?`)) return
    dispatch({ type: 'delete-topic', id: topic.id })
  }

  return (
    <div className="course-map" style={{ '--course': course.color }}>
      <header className="map-head">
        <Link to="/courses" className="map-back">← Courses</Link>
        <h2 className="map-title">
          <span className="course-dot" style={{ background: course.color }} />
          {course.name}
        </h2>
        {mine.length > 0 && (
          <div className="map-progress" title={`${done} of ${mine.length} topics learned`}>
            <span className="muted">{done} of {mine.length} learned</span>
            <span className="map-bar"><span style={{ width: `${(done / mine.length) * 100}%` }} /></span>
          </div>
        )}
        <button className="primary" onClick={() => add(null)}>+ Add topic</button>
      </header>

      <div className="map-canvas" ref={canvas}>
        <div className="map-stage" style={{ width: tree.width + PAD * 2, height: tree.height + PAD * 2 }}>
          <svg className="map-lines" width={tree.width + PAD * 2} height={tree.height + PAD * 2} aria-hidden="true">
            {tree.edges.map(({ from, to }) => {
              const a = at.get(from)
              const b = at.get(to)
              const x1 = a.x + PAD + NODE_W / 2
              const y1 = a.y + PAD + NODE_H
              const x2 = b.x + PAD + NODE_W / 2
              const y2 = b.y + PAD
              const mid = (y1 + y2) / 2
              return <path key={to} d={`M${x1} ${y1} C${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} />
            })}
          </svg>

          {tree.nodes.map(({ topic, x, y }) =>
            topic ? (
              <TopicNode
                key={topic.id}
                topic={topic}
                topics={state.topics}
                x={x + PAD}
                y={y + PAD}
                editing={editing === topic.id}
                onEdit={setEditing}
                onAdd={add}
                onRemove={remove}
                dispatch={dispatch}
              />
            ) : (
              <div
                key="root"
                className="map-node map-root"
                style={{ left: x + PAD, top: y + PAD, width: NODE_W, height: NODE_H }}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === 'Tab')) {
                    e.preventDefault()
                    add(null)
                  }
                }}
              >
                <span className="map-text">{course.name}</span>
                <span className="map-actions">
                  <button className="map-icon" aria-label="Add topic" title="Add topic" onClick={() => add(null)}>+</button>
                </span>
              </div>
            ),
          )}
        </div>

        {mine.length === 0 && (
          <p className="placeholder map-empty">Add the first topic. Each topic can hold its own sub-topics.</p>
        )}
      </div>
    </div>
  )
}

function TopicNode({ topic, topics, x, y, editing, onEdit, onAdd, onRemove, dispatch }) {
  const card = useRef(null)
  const settled = useRef(false)
  const branch = progress(topics, topic.id)
  const update = changes => dispatch({ type: 'update-topic', id: topic.id, changes })

  useEffect(() => {
    if (editing) settled.current = false
  }, [editing])

  // Enter, Escape and blur can all end one edit; only the first one counts.
  function finish(value) {
    if (settled.current) return
    settled.current = true
    const clean = value?.trim()
    if (clean) update({ text: clean })
    else if (!topic.text) dispatch({ type: 'delete-topic', id: topic.id }) // left blank: never existed
    onEdit(null)
    card.current?.focus()
  }

  function key(e) {
    if (e.target !== e.currentTarget) return
    const act = {
      Enter: () => onAdd(topic.parentId),
      Tab: () => onAdd(topic.id),
      Delete: () => onRemove(topic),
      Backspace: () => onRemove(topic),
      ' ': () => update({ done: !topic.done }),
      F2: () => onEdit(topic.id),
    }[e.key]
    if (act && !e.shiftKey) {
      e.preventDefault()
      act()
    }
  }

  return (
    <div
      ref={card}
      className={'map-node' + (topic.done ? ' done' : '')}
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
      tabIndex={0}
      onKeyDown={key}
      onDoubleClick={() => onEdit(topic.id)}
    >
      <input
        type="checkbox"
        checked={topic.done}
        onChange={() => update({ done: !topic.done })}
        aria-label={`Learned: ${topic.text || 'new topic'}`}
      />

      {editing ? (
        <input
          className="map-edit"
          autoFocus
          defaultValue={topic.text}
          placeholder="Topic name"
          maxLength={80}
          onKeyDown={e => {
            if (e.key === 'Enter') finish(e.currentTarget.value)
            if (e.key === 'Escape') finish(topic.text)
          }}
          onBlur={e => finish(e.currentTarget.value)}
        />
      ) : (
        <span className="map-text" title={`${topic.text} — double-click to rename`}>{topic.text}</span>
      )}

      {branch.total > 0 && (
        <button
          className="map-fold"
          onClick={() => update({ collapsed: !topic.collapsed })}
          aria-expanded={!topic.collapsed}
          aria-label={topic.collapsed ? `Show ${branch.total} sub-topics` : 'Hide sub-topics'}
          title={`${branch.done}/${branch.total} learned`}
        >
          {branch.done}/{branch.total} {topic.collapsed ? '▸' : '▾'}
        </button>
      )}

      <span className="map-actions">
        <button className="map-icon" aria-label="Add sub-topic" title="Add sub-topic" onClick={() => onAdd(topic.id)}>+</button>
        <button className="map-icon" aria-label={`Delete ${topic.text}`} title="Delete" onClick={() => onRemove(topic)}>✕</button>
      </span>
    </div>
  )
}
