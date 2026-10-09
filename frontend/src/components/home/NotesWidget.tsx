import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store.jsx";
import { ICON, addFileNotes, kindOf } from "../../lib/fileStore.js";
import { openable } from "./SectionWidgets";

type Note = { id: string; text: string; pdf?: { name: string } };

const SHOWN = 4;

/** The latest notes, one click from opening, and a drop target for files. */
export default function NotesWidget() {
  const { state, dispatch } = useStore() as {
    state: { notes: Note[] };
    dispatch: (action: unknown) => void;
  };
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);

  const openNote = (id?: string) => navigate(id ? `/notes?id=${id}` : "/notes");

  async function drop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const id = await addFileNotes(e.dataTransfer.files, dispatch);
    if (id) openNote(id);
  }

  return (
    <section
      className={dragging ? "widget widget-notes widget-open dragging" : "widget widget-notes widget-open"}
      {...openable(() => openNote(), "Open Notes")}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={drop}
    >
      <header className="widget-head">
        <h3>Notes</h3>
      </header>

      {state.notes.length > 0 && (
        <ul className="list widget-notes-list">
          {state.notes.slice(0, SHOWN).map((note) => (
            <li key={note.id}>
              <button className="notes-item" onClick={() => openNote(note.id)}>
                <span className="notes-item-title">
                  {note.pdf && ICON[kindOf(note.pdf.name) as keyof typeof ICON] + " "}
                  {note.text.split("\n").find((l) => l.trim())?.trim() || "Untitled"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="widget-drop">Drop PDFs, photos, slides, docs or sheets here</p>
    </section>
  );
}
