// Things shared into the Android app from another one (WhatsApp → Share →
// Stratus): files become file notes, a shared message or link a text note.
//
// Android hands them to @capgo/capacitor-share-target (the SEND intent
// filters in AndroidManifest.xml), which copies each file into the app's
// cache. This reads them back, holds them until Notes takes them, and sends
// the app to Notes. The website does the same through public/share-target-sw.js.

import { isNative } from './supabase.js'

/** Fired on window when a share has arrived and is waiting in takeNativeShare(). */
export const SHARE_EVENT = 'stratus-share'

let pending = { files: [], texts: [] }

/** What has been shared and not yet filed; each call empties it. */
export function takeNativeShare() {
  const out = pending
  pending = { files: [], texts: [] }
  return out
}

/** Call once at start-up. A share that opened the app arrives here too. */
export async function listenForShares() {
  if (!isNative) return
  const [{ CapacitorShareTarget }, { Capacitor }] = await Promise.all([
    import('@capgo/capacitor-share-target'),
    import('@capacitor/core'),
  ])
  CapacitorShareTarget.addListener('shareReceived', async event => {
    for (const f of event.files ?? []) {
      try {
        // The plugin gives a path in the app's own cache; the WebView reads it
        // through Capacitor's local file URL.
        const path = f.uri.startsWith('file://') || f.uri.startsWith('content://') ? f.uri : `file://${f.uri}`
        const blob = await (await fetch(Capacitor.convertFileSrc(path))).blob()
        pending.files.push(new File([blob], f.name, { type: f.mimeType || blob.type }))
      } catch { /* unreadable: skip that one */ }
    }
    for (const text of event.texts ?? []) if (text?.trim()) pending.texts.push(text.trim())
    if (!pending.files.length && !pending.texts.length) return

    // To Notes through the router (it follows popstate), not a reload.
    if (location.pathname !== '/notes') {
      history.pushState(null, '', '/notes')
      dispatchEvent(new PopStateEvent('popstate'))
    }
    dispatchEvent(new Event(SHARE_EVENT))
  })
}
