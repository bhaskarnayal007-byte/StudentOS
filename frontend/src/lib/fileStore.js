// Files attached to notes: PDFs, photos, slides, documents, spreadsheets.
//
// The note itself (title, subject, { pdf: { name, size } }) lives in the store
// and syncs like any other note. The file does not: whole-state sync is one
// JSON row and localStorage caps out around 5MB, so the bytes go in IndexedDB,
// keyed by note id. The field is still called `pdf` because notes saved
// before other file types existed already use it.
// ponytail: files stay on the device they were dropped on; move them to a
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

export const getFile = id => run('readonly', s => s.get(id))
export const deleteFile = id => run('readwrite', s => s.delete(id)).catch(() => {})

const KINDS = {
  pdf: ['pdf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic', 'heif'],
  slides: ['ppt', 'pptx', 'odp', 'key'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'txt'],
  sheet: ['xls', 'xlsx', 'ods', 'csv'],
}

export const ICON = { pdf: '📄', image: '🖼️', slides: '📊', doc: '📝', sheet: '📗' }

/** For the file picker's `accept`. */
export const ACCEPT = Object.values(KINDS).flat().map(ext => '.' + ext).join(',') + ',image/*'

/** Which kind of attachment a file name is, or undefined if we don't take it. */
export function kindOf(name, type = '') {
  const ext = name.split('.').pop().toLowerCase()
  return Object.keys(KINDS).find(k => KINDS[k].includes(ext)) ?? (type.startsWith('image/') ? 'image' : undefined)
}

/** Turn each dropped file into a note. Returns the id of the last one added. */
export async function addFileNotes(files, dispatch, courseId) {
  let last
  for (const file of [...files].filter(f => kindOf(f.name, f.type))) {
    const id = crypto.randomUUID()
    await run('readwrite', s => s.put(file, id))
    dispatch({
      type: 'add-note',
      note: {
        id,
        text: file.name.replace(/\.[^.]+$/, ''),
        courseId,
        pdf: { name: file.name, size: file.size },
      },
    })
    last = id
  }
  return last
}
