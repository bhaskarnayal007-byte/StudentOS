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

export const deleteFile = id => run('readwrite', s => s.delete(id)).catch(() => {})

// Raster images and PDFs can't run script. An SVG or HTML file can, and a
// blob: URL opened in a tab runs in this origin, next to the signed-in session.
// The type a file arrives with is whatever the app that made or shared it
// said, so it doesn't count for anything else.
const SAFE = /^(image\/(png|jpe?g|gif|webp|avif|bmp|heic|heif)|application\/pdf)$/

/**
 * A URL that shows a stored file but can't run script, however it's opened,
 * or undefined if the file isn't on this device. Revoke it when done. Files
 * are only ever read through here, so nothing can link the raw bytes.
 */
export async function fileUrl(id, name) {
  const blob = await run('readonly', s => s.get(id))
  if (!blob) return
  // An SVG only draws with its own type, which is the type that runs its
  // script. As a data: URL it still draws in an <img>, but a tab won't open
  // it, and if one did it would have an origin of its own, not this one.
  if (/\.svg$/i.test(name)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob.slice(0, blob.size, 'image/svg+xml'))
    })
  }
  // Anything else unknown downloads instead of opening.
  const type = kindOf(name) === 'pdf' ? 'application/pdf' : SAFE.test(blob.type) ? blob.type : 'application/octet-stream'
  return URL.createObjectURL(blob.slice(0, blob.size, type))
}

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
