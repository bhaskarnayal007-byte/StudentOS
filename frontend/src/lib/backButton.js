// Android's back button in the app. Whatever is open on top (Octi's panel, a
// sheet) gets it first; otherwise it walks back, then to Home, then puts the
// app in the background the way Android apps do. Does nothing in a browser.
import { useEffect, useRef } from 'react'
import { isNative } from './supabase.js'

// Overlays, newest first. Each returns true if it handled the press.
const overlays = []
// The app's own navigation, asked only when no overlay took the press. Kept
// apart from `overlays` because React mounts children first, so registration
// order can't be what puts it last.
let navigation = () => false

if (isNative) {
  import('@capacitor/app').then(({ App }) => {
    // Registering any listener turns off Capacitor's default (history back,
    // then quit), so navigation and minimizeApp below cover that too.
    App.addListener('backButton', ({ canGoBack }) => {
      for (const handle of overlays) if (handle({ canGoBack })) return
      if (navigation({ canGoBack })) return
      App.minimizeApp()
    })
  })
}

/** Keeps `handle` current in a ref so the effect needn't re-register. */
function useLatest(handle) {
  const latest = useRef(handle)
  latest.current = handle
  return latest
}

/**
 * An overlay (a panel, a sheet) takes the back button while `open`:
 * `handle()` closes it. The most recently opened goes first.
 */
export function useBackToClose(handle, open) {
  const latest = useLatest(handle)
  useEffect(() => {
    if (!isNative || !open) return
    const fn = () => (latest.current(), true)
    overlays.unshift(fn)
    return () => overlays.splice(overlays.indexOf(fn), 1)
  }, [open, latest])
}

/** The app shell's back: returns true if it navigated, false to minimize. */
export function useBackNavigation(handle) {
  const latest = useLatest(handle)
  useEffect(() => {
    if (!isNative) return
    navigation = (e) => latest.current(e)
    return () => { navigation = () => false }
  }, [latest])
}
