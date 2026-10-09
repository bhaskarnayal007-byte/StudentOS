import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { CoursePicker, CourseChip } from './Courses.jsx'
import { ACCEPT, ICON, addFileNotes, deleteFile, getFile, kindOf } from '../lib/fileStore.js'

/**
 * Notes, with their own sidebar: every saved note listed on the left, the one
 * you're reading open on the right. On a phone the two stack — the list, then
 * the note once you tap one, with a back button.
 *
 * Still edited in place: typing writes straight to the store, no save button.
 * Drop files (PDFs, photos, slides, docs, sheets) anywhere on the panel and
 * each becomes a note of its own.
 */
export default function Notes() {
  const { state, dispatch } = useStore()
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState(params.get('id'))
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [split, setSplit] = useState(() => {
    try { return Number(localStorage.getItem(SPLIT_KEY)) || 50 } catch { return 50 }
  })

  useEffect(() => {
    try { localStorage.setItem(SPLIT_KEY, String(split)) } catch { /* private window */ }
  }, [split])

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
    const id = await addFileNotes(files, dispatch, filter || undefined)
    if (id) setOpenId(id)
  }

  function drop(e) {
    e.preventDefault()
    setDragging(false)
    attach(e.dataTransfer.files)
  }

  function remove(id) {
    dispatch({ type: 'delete-note', id })
    deleteFile(id)
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
          <button
            onClick={() => fileInput.current.click()}
            title="Add PDFs, photos, slides, Word docs or spreadsheets — or drag them here"
          >
            + File
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
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
                <span className="notes-item-title">{note.pdf && ICON[kindOf(note.pdf.name)] + ' '}{title(note.text)}</span>
                {snippet(note.text) && <span className="notes-item-snippet">{snippet(note.text)}</span>}
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
              ? 'No notes yet. Write one, drop in files, or ask Octi.'
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
              <span className="muted">
                {words(open.text)} words · {when(open.updatedAt)}
              </span>
              <button className="ghost" aria-label="Delete note" onClick={() => remove(open.id)}>✕</button>
            </div>
            {/* A PDF or photo sits beside the writing on a wide screen, so
                neither squeezes the other; a file card just sits on top. */}
            <div
              className={
                open.pdf && previews(open.pdf.name)
                  ? 'note-work note-split'
                  : 'note-work'
              }
              style={{ '--split': `${split}%` }}
            >
              {open.pdf && (
                <div className="note-preview">
                  <FileView id={open.id} name={open.pdf.name} size={open.pdf.size} />
                </div>
              )}
              {open.pdf && previews(open.pdf.name) && <Divider value={split} onChange={setSplit} />}
              <textarea
                key={open.id}
                className="note-body"
                autoFocus={!open.pdf}
                placeholder="Anything worth keeping — a formula, what the lecturer said, a reminder to yourself. The first line is the title."
                value={open.text}
                onChange={e =>
                  dispatch({ type: 'update-note', id: open.id, changes: { text: e.target.value } })
                }
              />
            </div>
          </>
        ) : (
          <p className="placeholder">Pick a note on the left, start a new one, or drop files here.</p>
        )}
      </section>
    </div>
  )
}

/**
 * PDFs and photos the browser can show itself. Slides, Word docs and
 * spreadsheets it can't, so those are a card that opens them in their app.
 * ponytail: no in-page Office preview; add mammoth/SheetJS if reading them
 * here matters more than the extra JavaScript.
 */
function FileView({ id, name, size, tab = false }) {
  const [url, setUrl] = useState()
  const [missing, setMissing] = useState(false)
  const [broken, setBroken] = useState(false)
  const kind = kindOf(name)

  useEffect(() => {
    let objectUrl
    setUrl(undefined)
    setMissing(false)
    setBroken(false)
    getFile(id).then(blob => {
      if (!blob) return setMissing(true)
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }, () => setMissing(true))
    return () => objectUrl && URL.revokeObjectURL(objectUrl)
  }, [id])

  if (missing) {
    return <p className="placeholder">“{name}” was added on another device — files stay where they were dropped.</p>
  }
  if (!url) return null

  if (kind === 'pdf') {
    return (
      <>
        <iframe className="notes-pdf" src={url} title={name} />
        <a className="widget-link notes-pdf-open" href={url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
      </>
    )
  }
  if (previews(name) && kind === 'slides' && !broken) {
    return (
      <>
        <SlidesView url={url} onFail={() => setBroken(true)} />
        <span className="notes-pdf-open">
          {!tab && (
            <a className="widget-link" href={`/view/${id}`} target="_blank" rel="noreferrer">Open in new tab ↗</a>
          )}
          <a className="widget-link" href={url} download={name}>Download ↓</a>
        </span>
      </>
    )
  }
  // HEIC and the like count as photos but most browsers can't draw them.
  if (kind === 'image' && !broken) {
    return (
      <a className="notes-image" href={url} target="_blank" rel="noreferrer" title="Open full size">
        <img src={url} alt={name} onError={() => setBroken(true)} />
      </a>
    )
  }
  return (
    <div className="notes-file">
      <span className="notes-file-icon" aria-hidden="true">{ICON[kind] ?? '📎'}</span>
      <span className="notes-file-name">
        <strong>{name}</strong>
        <span className="muted">{(size / 1024 / 1024).toFixed(1)} MB</span>
      </span>
      <a className="primary" href={url} download={name}>Download</a>
    </div>
  )
}

/** Whether a file is shown in the page, rather than as a card to download. */
function previews(name) {
  const kind = kindOf(name)
  return kind === 'pdf' || kind === 'image' || (kind === 'slides' && /\.pptx$/i.test(name))
}

/**
 * A .pptx drawn slide by slide. The renderer (and the charting library it
 * pulls in) is fetched only when a deck is opened, so nothing else pays for it.
 */
function SlidesView({ url, onFail }) {
  const box = useRef(null)
  const [width, setWidth] = useState(0)

  // Redrawn at the new width once a resize settles, not on every pixel of a drag.
  useEffect(() => {
    let timer
    const observer = new ResizeObserver(([entry]) => {
      clearTimeout(timer)
      timer = setTimeout(() => setWidth(Math.round(entry.contentRect.width)), 200)
    })
    observer.observe(box.current)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!width) return
    const node = box.current
    let previewer
    let cancelled = false
    Promise.all([import('pptx-preview'), fetch(url).then(r => r.arrayBuffer())])
      .then(([{ init }, buf]) => {
        if (cancelled) return
        previewer = init(node, { width, height: Math.round((width * 9) / 16), mode: 'list' })
        return previewer.preview(buf)
      })
      .catch(() => !cancelled && onFail())
    return () => {
      cancelled = true
      previewer?.destroy()
      node.innerHTML = ''
    }
  }, [url, width])

  return <div ref={box} className="notes-slides" />
}

const SPLIT_KEY = 'notes-split'

/** The handle between an attachment and the writing: drag it, or use the arrow keys. */
function Divider({ value, onChange }) {
  const clamp = n => Math.min(80, Math.max(20, Math.round(n)))

  function drag(e) {
    const handle = e.currentTarget
    const box = handle.parentElement.getBoundingClientRect()
    handle.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
    const move = ev => onChange(clamp(((ev.clientX - box.left) / box.width) * 100))
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', () => {
      handle.removeEventListener('pointermove', move)
      document.body.style.userSelect = ''
    }, { once: true })
  }

  function key(e) {
    const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key]
    if (step) { e.preventDefault(); onChange(clamp(value + step)) }
  }

  return (
    <div
      className="note-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize preview and notes"
      aria-valuenow={value}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      onPointerDown={drag}
      onKeyDown={key}
      onDoubleClick={() => onChange(50)}
      title="Drag to resize · double-click to reset"
    />
  )
}

/** A note's file on a page of its own, for "Open in new tab". */
export function FileTab() {
  const { id } = useParams()
  const { state } = useStore()
  const note = state.notes.find(n => n.id === id)

  useEffect(() => {
    if (note) document.title = `${title(note.text)} · Student OS`
  }, [note])

  return (
    <div className="file-tab">
      {note?.pdf ? (
        <>
          <h2>{title(note.text)}</h2>
          <FileView id={id} name={note.pdf.name} size={note.pdf.size} tab />
        </>
      ) : (
        <p className="placeholder">This file isn't on this device.</p>
      )}
    </div>
  )
}

/** The first non-empty line, so a note names itself. */
function title(text) {
  const line = text.split('\n').find(l => l.trim())
  return line ? line.trim().slice(0, 60) : 'Untitled'
}

/** The line after the title, as a preview in the list. */
function snippet(text) {
  return text.split('\n').filter(l => l.trim())[1]?.trim().slice(0, 90) ?? ''
}

function words(text) {
  return text.split(/\s+/).filter(Boolean).length
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
