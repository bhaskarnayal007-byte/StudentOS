// The /courses/:id page: a subject's mind map of topics.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { INDENT, NODE_H, NODE_W, columns, descendants, outline, progress } from '../lib/topics.js'
import { PHONE, useMatchMedia } from '../lib/useMatchMedia.js'
import ShareButton from './ShareButton.jsx'

// Breathing room around the tree inside the scrollable canvas; less on phones.
const PAD_WIDE = 32
const PAD_PHONE = 10

/**
 * A subject's mind map: the subject at the top, topics beneath it, sub-topics
 * beneath those. The tree lays itself out — you only ever add, rename, tick
 * off, fold and delete.
 */
export default function CourseMapPage() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(null)
  const course = state.courses.find(c => c.id === id)

  // Phones get one indented outline that reads top to bottom; wider screens
  // get a card per branch, packed into as many columns as fit (lib/topics.js).
  // Either way the map fits the width, so it never scrolls sideways.
  const phone = useMatchMedia(PHONE)
  const PAD = phone ? PAD_PHONE : PAD_WIDE
  const canvas = useRef(null)
  const [canvasW, setCanvasW] = useState(0)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [Boolean(course)]) // eslint-disable-line react-hooks/exhaustive-deps

  const tree = useMemo(() => {
    const room = Math.max(0, canvasW - PAD * 2)
    return phone ? outline(state.topics, id, room) : columns(state.topics, id, room)
  }, [state.topics, id, phone, canvasW, PAD])

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
        {mine.length > 0 && <ShareButton kind="map" item={course} />}
        <button className="primary" onClick={() => add(null)}>+ Add topic</button>
      </header>

      <div className={phone ? 'map-canvas' : 'map-canvas wide'} ref={canvas}>
        <div className="map-stage" style={{ width: tree.width + PAD * 2, height: tree.height + PAD * 2 }}>
          {/* Wide screens: a card behind each top-level branch. */}
          {tree.cards?.map(c => (
            <div key={c.id} className="map-branch" style={{ left: c.x + PAD, top: c.y + PAD, width: c.w, height: c.h }} />
          ))}

          <svg className="map-lines" width={tree.width + PAD * 2} height={tree.height + PAD * 2} aria-hidden="true">
            {tree.edges.map(({ from, to }) => {
              const a = at.get(from)
              const b = at.get(to)
              // Elbow: down from just inside the parent's left edge, across to the child.
              const x = a.x + PAD + INDENT / 2
              const ah = a.h ?? NODE_H
              const bh = b.h ?? NODE_H
              return <path key={to} d={`M${x} ${a.y + PAD + ah} V${b.y + PAD + bh / 2} H${b.x + PAD}`} />
            })}
          </svg>

          {tree.nodes.map(({ topic, x, y, w = NODE_W, h = NODE_H, head }) =>
            topic ? (
              <TopicNode
                key={topic.id}
                topic={topic}
                topics={state.topics}
                x={x + PAD}
                y={y + PAD}
                w={w}
                h={h}
                head={head}
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
                style={{ left: x + PAD, top: y + PAD, width: w, height: NODE_H }}
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

function TopicNode({ topic, topics, x, y, w, h, head, editing, onEdit, onAdd, onRemove, dispatch }) {
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
      className={'map-node' + (topic.done ? ' done' : '') + (head ? ' map-head-row' : '')}
      style={{ left: x, top: y, width: w, height: h }}
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
