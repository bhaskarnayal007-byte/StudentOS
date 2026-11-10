// Files attached to notes: PDFs, photos, slides, documents, spreadsheets.
//
// The note itself (title, subject, { pdf: { name, size } }) lives in the store
// and syncs like any other note. The file can't ride along: whole-state sync is
// one JSON row and localStorage caps out around 5MB. So the bytes go to the
// account's private `note-files` bucket (supabase/migrations/0008), at
// <user id>/<note id>, and IndexedDB keeps a copy on each device that has
// opened it. The field is still called `pdf` because notes saved before other
// file types existed already use it.

import { supabase } from './supabase.js'
import { me } from './social.js'

// Named before the rename to Stratus. Renaming it would strand every file
// already stored, so it stays.
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

const BUCKET = 'note-files'
const cloudPath = async id => `${await me()}/${id}`

// Ids this device has uploaded, so a file is sent once. Per account; the
// `:<user id>` suffix is what account deletion clears (useSession.js).
const UPLOADED = uid => `stratus-files-up:${uid}`
function uploadedIds(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(UPLOADED(uid)) || '[]')) } catch { return new Set() }
}
function markUploaded(uid, id) {
  const ids = uploadedIds(uid)
  ids.add(id)
  try { localStorage.setItem(UPLOADED(uid), JSON.stringify([...ids])) } catch { /* private mode */ }
}

const inFlight = new Set()

// How each upload is going this session, for the note showing the file:
// 'uploading', or why it didn't land. Gone once it has.
const status = new Map()
/** Fired on window whenever uploadStatus() changes. */
export const FILES_EVENT = 'stratus-files'
export const uploadStatus = id => status.get(id)
function setStatus(id, value) {
  if (value) status.set(id, value)
  else status.delete(id)
  dispatchEvent(new Event(FILES_EVENT))
}

// The bucket's limit (supabase/migrations/0008), and the free plan's.
const MAX_BYTES = 50 * 1024 * 1024

/** Send one stored file to the account. Offline or failed, it stays queued
 *  and the next uploadPending() tries again. */
async function upload(id, blob) {
  if (inFlight.has(id)) return
  if (blob.size > MAX_BYTES) return setStatus(id, "It's over 50 MB, so it stays on this device only.")
  inFlight.add(id)
  setStatus(id, 'uploading')
  try {
    const uid = await me()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${uid}/${id}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
    if (error) throw error
    markUploaded(uid, id)
    setStatus(id)
  } catch (err) {
    setStatus(id, navigator.onLine ? `Upload failed (${err?.message || 'unknown error'}). It will try again.` : "Offline. It will upload when you're back online.")
  } finally {
    inFlight.delete(id)
  }
}

/**
 * Upload every file this device holds that the account doesn't have yet:
 * ones added offline, and ones added before files synced at all.
 */
export async function uploadPending(notes) {
  let uid
  try { uid = await me() } catch { return }
  const done = uploadedIds(uid)
  for (const note of notes) {
    if (!note.pdf || done.has(note.id)) continue
    const blob = await run('readonly', s => s.get(note.id)).catch(() => undefined)
    if (blob) await upload(note.id, blob)
  }
}

/** The file's bytes: this device's copy, else the account's (kept here after). */
async function fileBlob(id) {
  const local = await run('readonly', s => s.get(id)).catch(() => undefined)
  if (local) return local
  const uid = await me()
  const { data } = await supabase.storage.from(BUCKET).download(`${uid}/${id}`)
  if (!data) return undefined
  await run('readwrite', s => s.put(data, id)).catch(() => {})
  markUploaded(uid, id) // it came from the account, so never send it back
  return data
}

export async function deleteFile(id) {
  await run('readwrite', s => s.delete(id)).catch(() => {})
  try {
    await supabase.storage.from(BUCKET).remove([await cloudPath(id)])
  } catch { /* offline: the bucket keeps an orphan, which only its owner can see */ }
}

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
  const blob = await fileBlob(id)
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
    upload(id, file) // in the background; uploadPending() retries if it fails
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
