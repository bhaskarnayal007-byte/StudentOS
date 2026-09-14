import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { faviconFor } from '../store.jsx'

// Paste a URL → we guess a name and an icon → you edit either → save.
//
// A note on the "auto-fetch title" idea: we can't read another site's <title>
// from the browser. Fetching https://notion.so from JS is blocked by CORS, and
// no amount of trying changes that — it would need a server to fetch on our
// behalf. The favicon works because it's loaded as an <img>, which is not
// subject to CORS. So the name is derived from the hostname, and you can edit
// it before saving.
export default function AddAppModal({ initial, onSave, onClose }) {
  const editing = Boolean(initial)
  const [url, setUrl] = useState(initial?.url ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '')
  const [customIcon, setCustomIcon] = useState(Boolean(initial?.iconUrl?.startsWith('data:')))
  const [error, setError] = useState('')

  const firstField = useRef(null)
  useEffect(() => { firstField.current?.focus() }, [])

  // Esc closes. Registered on document so it works wherever focus is.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // As the URL changes, refresh the guessed name + icon — but never overwrite
  // something the user has deliberately typed or uploaded.
  function onUrlChange(value) {
    setUrl(value)
    setError('')
    const parsed = normalize(value)
    if (!parsed) return
    if (!customIcon) setIconUrl(faviconFor(parsed.href))
    if (!name || name === guessName(url)) setName(guessName(value))
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('That file is not an image.')
    // Downscale to 64px before storing. localStorage holds ~5MB total, and a
    // full-size photo as a data URL would eat it in a couple of icons.
    shrinkToDataUrl(file, 64)
      .then(dataUrl => { setIconUrl(dataUrl); setCustomIcon(true) })
      .catch(() => setError("Couldn't read that image."))
  }

  function submit(e) {
    e.preventDefault()
    const parsed = normalize(url)
    if (!parsed) return setError('Enter a valid web address, e.g. notion.so')
    onSave({
      name: name.trim() || guessName(url),
      url: parsed.href,
      iconUrl: iconUrl || faviconFor(parsed.href),
    })
  }

  // Rendered into <body> via a portal, NOT where it sits in the tree.
  // The sidebar has `backdrop-filter`, and any ancestor with a filter,
  // transform or backdrop-filter becomes the containing block for
  // `position: fixed` descendants — so an in-place modal would be trapped
  // inside the 168px sidebar instead of covering the viewport.
  return createPortal(
    // Clicking the dark backdrop closes; clicking the panel must not, hence
    // stopPropagation on the inner element.
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit shortcut' : 'Add shortcut'}
        onMouseDown={e => e.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h3>{editing ? 'Edit shortcut' : 'Add a shortcut'}</h3>

          <label className="field">
            <span>Web address</span>
            <input
              ref={firstField}
              className="grow"
              placeholder="notion.so"
              value={url}
              onChange={e => onUrlChange(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Name</span>
            <input
              className="grow"
              placeholder="Notion"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>

          <div className="field">
            <span>Icon</span>
            <div className="icon-row">
              <span className="icon-preview">
                {iconUrl
                  ? <img src={iconUrl} alt="" onError={() => setIconUrl('')} />
                  : <b>{(name || url || '?').trim().charAt(0).toUpperCase()}</b>}
              </span>
              <label className="file-btn">
                Upload
                <input type="file" accept="image/*" onChange={onFile} hidden />
              </label>
              {customIcon && (
                <button
                  type="button"
                  onClick={() => { setCustomIcon(false); setIconUrl(faviconFor(normalize(url)?.href || '')) }}
                >
                  Use site icon
                </button>
              )}
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary">{editing ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// "notion.so" → URL object for https://notion.so. Returns null if unusable.
// Users type bare domains far more often than full URLs, so assume https.
function normalize(value) {
  const raw = (value || '').trim()
  if (!raw) return null
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withProtocol)
    // A hostname with no dot ("notion") isn't a real site.
    return u.hostname.includes('.') ? u : null
  } catch {
    return null
  }
}

// "https://mail.google.com/x" → "Mail google"
function guessName(value) {
  const u = normalize(value)
  if (!u) return ''
  const label = u.hostname.replace(/^www\./, '').split('.').slice(0, -1).join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Read an image file, draw it into a small square canvas, return a data URL.
function shrinkToDataUrl(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')
        // Cover-fit: crop the long edge instead of squashing the image.
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
