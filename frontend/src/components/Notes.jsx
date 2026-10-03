import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { CoursePicker, CourseChip } from './Courses.jsx'
import { addPdfNotes, deletePdf, getPdf } from '../lib/pdfStore.js'

/**
 * Notes, with their own sidebar: every saved note listed on the left, the one
 * you're reading open on the right. On a phone the two stack — the list, then
 * the note once you tap one, with a back button.
 *
 * Still edited in place: typing writes straight to the store, no save button.
 * Drop PDFs anywhere on the panel and each becomes a note of its own.
 */
export default function Notes() {
  const { state, dispatch } = useStore()
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState(params.get('id'))
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')

  const open = state.notes.find(n => n.id === openId)

  // A note left blank isn't worth keeping — drop it when you move away.
  function leave() {
    if (open && !open.pdf && !open.text.trim()) dispatch({ type: 'delete-note', id: open.id })
  }

  function select(id) {
    if (id !== openId) leave()
    setOpenId(id)
  }

  function create() {
    leave()
    const id = crypto.randomUUID()
    dispatch({ type: 'add-note', note: { id, text: '', courseId: filter || undefined } })
    setOpenId(id)
    setQuery('')
  }

  async function attach(files) {
    leave()
    const id = await addPdfNotes(files, dispatch, filter || undefined)
    if (id) setOpenId(id)
  }

  function drop(e) {
    e.preventDefault()
    setDragging(false)
    attach(e.dataTransfer.files)
  }

  function remove(id) {
    dispatch({ type: 'delete-note', id })
    deletePdf(id)
    setOpenId(null)
  }

  const q = query.trim().toLowerCase()
  const shown = state.notes.filter(
    n => (!filter || n.courseId === filter) && (!q || n.text.toLowerCase().includes(q)),
  )

  return (
    <div
      className={'notes' + (open ? ' notes-reading' : '') + (dragging ? ' notes-dragging' : '')}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
      onDrop={drop}
    >
      <aside className="notes-side">
        <div className="row notes-add">
          <button className="primary grow" onClick={create}>+ New note</button>
          <button onClick={() => fileInput.current.click()} title="Add PDF notes — or drag them here">
            + PDF
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={e => { attach(e.target.files); e.target.value = '' }}
          />
        </div>
        <input
          type="search"
          placeholder="Search notes"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search notes"
        />
        {state.courses.length > 0 && (
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {state.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <ul className="notes-index">
          {shown.map(note => (
            <li key={note.id}>
              <button
                className={note.id === openId ? 'notes-item active' : 'notes-item'}
                onClick={() => select(note.id)}
              >
                <span className="notes-item-title">{note.pdf && '📄 '}{title(note.text)}</span>
                <span className="notes-item-meta">
                  <CourseChip courseId={note.courseId} />
                  <span className="muted">{when(note.updatedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {shown.length === 0 && (
          <p className="placeholder">
            {state.notes.length === 0
              ? 'No notes yet. Write one, drop in PDFs, or ask Octi.'
              : 'No notes match.'}
          </p>
        )}
      </aside>

      <section className="notes-editor">
        {open ? (
          <>
            <div className="note-meta">
              <button className="ghost notes-back" onClick={() => select(null)}>← All notes</button>
              <CoursePicker
                value={open.courseId}
                onChange={courseId => dispatch({ type: 'update-note', id: open.id, changes: { courseId } })}
              />
              <span className="muted">{when(open.updatedAt)}</span>
              <button className="ghost" aria-label="Delete note" onClick={() => remove(open.id)}>✕</button>
            </div>
            {open.pdf && <PdfView id={open.id} name={open.pdf.name} />}
            <textarea
              key={open.id}
              className={open.pdf ? 'note-body note-body-pdf' : 'note-body'}
              autoFocus={!open.pdf}
              placeholder="Anything worth keeping — a formula, what the lecturer said, a reminder to yourself. The first line is the title."
              value={open.text}
              onChange={e =>
                dispatch({ type: 'update-note', id: open.id, changes: { text: e.target.value } })
              }
            />
          </>
        ) : (
          <p className="placeholder">Pick a note on the left, start a new one, or drop PDFs here.</p>
        )}
      </section>
    </div>
  )
}

/** The browser's own PDF viewer, fed from IndexedDB. */
function PdfView({ id, name }) {
  const [url, setUrl] = useState()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let objectUrl
    setUrl(undefined)
    setMissing(false)
    getPdf(id).then(blob => {
      if (!blob) return setMissing(true)
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }, () => setMissing(true))
    return () => objectUrl && URL.revokeObjectURL(objectUrl)
  }, [id])

  if (missing) {
    return <p className="placeholder">“{name}” was added on another device — PDFs stay where they were dropped.</p>
  }
  if (!url) return null
  return (
    <>
      <iframe className="notes-pdf" src={url} title={name} />
      <a className="widget-link notes-pdf-open" href={url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
    </>
  )
}

/** The first non-empty line, so a note names itself. */
function title(text) {
  const line = text.split('\n').find(l => l.trim())
  return line ? line.trim().slice(0, 60) : 'Untitled'
}

/** "3 minutes ago" is noise on a note; the day it was written is not. */
function when(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date.getTime() >= today.getTime()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
