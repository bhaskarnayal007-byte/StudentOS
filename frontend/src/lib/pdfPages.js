// Draws a PDF page by page with PDF.js. The browser's own viewer can't be
// relied on: Android Chrome (and so the installed app) has none, and iOS shows
// only the first page in a frame. Imported dynamically by Notes, so PDF.js
// (~1 MB with its worker) downloads only when a PDF is actually opened.

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Lays out every page of `data` (an ArrayBuffer) in `container` at `width`
 * CSS pixels, drawing each one only as it nears the screen, so a 200-page
 * reader doesn't paint 200 canvases up front. Returns a cleanup function.
 */
export async function renderPdf(data, container, width) {
  const doc = await pdfjs.getDocument({ data }).promise
  // Sharp on high-density phone screens, but capped: a 3x canvas per page
  // adds up fast on a long document.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const drawn = new Set()

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const holder = entry.target
        observer.unobserve(holder)
        draw(Number(holder.dataset.page), holder)
      }
    },
    { rootMargin: '600px 0px' }, // start a screen or so ahead of the scroll
  )

  async function draw(number, holder) {
    if (drawn.has(number)) return
    drawn.add(number)
    const page = await doc.getPage(number)
    const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.setAttribute('aria-label', `Page ${number}`)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    holder.replaceChildren(canvas)
  }

  // Placeholders at each page's real shape first, so scrolling and the
  // scrollbar are right before anything is drawn.
  for (let n = 1; n <= doc.numPages; n++) {
    if (!container.isConnected) break // closed while still laying out
    const page = await doc.getPage(n)
    const { width: w, height: h } = page.getViewport({ scale: 1 })
    const holder = document.createElement('div')
    holder.className = 'pdf-page'
    holder.dataset.page = String(n)
    holder.style.aspectRatio = `${w} / ${h}`
    container.append(holder)
    observer.observe(holder)
  }

  return () => {
    observer.disconnect()
    doc.destroy()
  }
}
