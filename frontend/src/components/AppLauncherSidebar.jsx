import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store.jsx'
import AddAppModal from './AddAppModal.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// QUICK LAUNCH
//
// A vertical strip of shortcuts to external sites. Clicking one opens it in a
// new tab. Deliberately NOT an iframe: Docs, Notion and Duolingo all send
// X-Frame-Options / frame-ancestors headers that make embedding fail, and the
// failure is a blank white box with no error — the worst kind.
// ─────────────────────────────────────────────────────────────────────────────

export default function AppLauncherSidebar() {
  const { state, dispatch } = useStore()
  const [modal, setModal] = useState(null) // null | 'add' | shortcut being edited

  // Pointer sensor with a small distance threshold: a drag only begins after
  // 6px of movement, so a plain click still registers as a click and opens the
  // app. Without this every click would be swallowed by the drag handler.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    dispatch({
      type: 'move-shortcut',
      from: state.shortcuts.findIndex(s => s.id === active.id),
      to: state.shortcuts.findIndex(s => s.id === over.id),
    })
  }

  function save(data) {
    if (modal === 'add') dispatch({ type: 'add-shortcut', shortcut: data })
    else dispatch({ type: 'update-shortcut', id: modal.id, changes: data })
    setModal(null)
  }

  return (
    <aside className="launcher" aria-label="Quick launch">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={state.shortcuts.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="launcher-list">
            {state.shortcuts.map(shortcut => (
              <AppIcon
                key={shortcut.id}
                shortcut={shortcut}
                onEdit={() => setModal(shortcut)}
                onRemove={() => dispatch({ type: 'delete-shortcut', id: shortcut.id })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <AddAppButton onClick={() => setModal('add')} />

      {modal && (
        <AddAppModal
          initial={modal === 'add' ? null : modal}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </aside>
  )
}

// Used by the sidebar and by the home screen's app buttons.
// noopener,noreferrer matters: without noopener the opened page gets a
// window.opener handle back to this app and can navigate it elsewhere.
export function openShortcut(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ─── One shortcut ────────────────────────────────────────────────────────────
export function AppIcon({ shortcut, onEdit, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: shortcut.id })
  const [broken, setBroken] = useState(false)

  const open = () => openShortcut(shortcut.url)

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'launch-item dragging' : 'launch-item'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // The sortable listeners make this a button-like drag target; onClick
      // still fires because of the 6px activation distance above.
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter') open() }}
      title={`${shortcut.name} — ${shortcut.url}`}
    >
      <span className="launch-icon">
        {shortcut.iconUrl && !broken
          ? <img src={shortcut.iconUrl} alt="" onError={() => setBroken(true)} draggable="false" />
          : <b>{shortcut.name.trim().charAt(0).toUpperCase() || '?'}</b>}
      </span>

      <span className="launch-name">{shortcut.name}</span>

      {/* stopPropagation so these don't trigger the parent's "open the app". */}
      <span className="launch-tools">
        <button
          className="ghost"
          aria-label={`Edit ${shortcut.name}`}
          onClick={e => { e.stopPropagation(); onEdit() }}
          onPointerDown={e => e.stopPropagation()}
        >
          ✎
        </button>
        <button
          className="ghost"
          aria-label={`Remove ${shortcut.name}`}
          onClick={e => { e.stopPropagation(); onRemove() }}
          onPointerDown={e => e.stopPropagation()}
        >
          ✕
        </button>
      </span>
    </li>
  )
}

// ─── Add button ──────────────────────────────────────────────────────────────
export function AddAppButton({ onClick }) {
  return (
    <button className="launch-add" onClick={onClick} aria-label="Add app shortcut">
      <span className="launch-icon">+</span>
      <span className="launch-name">Add app</span>
    </button>
  )
}
