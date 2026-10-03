// PDF files attached to notes.
//
// The note itself (title, subject, { pdf: { name, size } }) lives in the store
// and syncs like any other note. The file does not: whole-state sync is one
// JSON row and localStorage caps out around 5MB, so the bytes go in IndexedDB,
// keyed by note id.
// ponytail: PDFs stay on the device they were dropped on; move them to a
// Supabase Storage bucket if they need to follow the account.

const DB = 'student-os-pdfs'
const STORE = 'pdfs'

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const conn = await db()
  return new Promise((resolve, reject) => {
    const req = fn(conn.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const getPdf = id => run('readonly', s => s.get(id))
export const deletePdf = id => run('readwrite', s => s.delete(id)).catch(() => {})

export const isPdf = file =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

/** Turn each dropped PDF into a note. Returns the id of the last one added. */
export async function addPdfNotes(files, dispatch, courseId) {
  let last
  for (const file of [...files].filter(isPdf)) {
    const id = crypto.randomUUID()
    await run('readwrite', s => s.put(file, id))
    dispatch({
      type: 'add-note',
      note: {
        id,
        text: file.name.replace(/\.pdf$/i, ''),
        courseId,
        pdf: { name: file.name, size: file.size },
      },
    })
    last = id
  }
  return last
}
