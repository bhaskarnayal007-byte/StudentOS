/**
 * The phone's own app for a shortcut's website, where we know it.
 *
 * host → [Android package, iOS URL scheme, does the iOS scheme take the path].
 * Android gets an intent:// URL, which opens the app if installed and the
 * website (browser_fallback_url) if not. iOS has no such thing, only per-app
 * schemes, so the caller has to fall back itself.
 */
const APPS = {
  'mail.google.com':      ['com.google.android.gm', 'googlegmail://', false],
  'docs.google.com':      ['com.google.android.apps.docs.editors.docs', 'googledocs://', true],
  'drive.google.com':     ['com.google.android.apps.docs', 'googledrive://', false],
  'classroom.google.com': ['com.google.android.apps.classroom', 'googleclassroom://', false],
  'notion.so':            ['notion.id', 'notion://', true],
  'notion.com':           ['notion.id', 'notion://', true],
  'duolingo.com':         ['com.duolingo', 'duolingo://', false],
  'youtube.com':          ['com.google.android.youtube', 'youtube://', true],
  'web.whatsapp.com':     ['com.whatsapp', 'whatsapp://', false],
  'instagram.com':        ['com.instagram.android', 'instagram://', false],
  'open.spotify.com':     ['com.spotify.music', 'spotify://', false],
}

/** 'android' | 'ios' | null, from what the browser says it is. */
export function phonePlatform(nav = navigator) {
  if (/Android/i.test(nav.userAgent)) return 'android'
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)) return 'ios'
  return null
}

/** The URL that opens the native app, or null to just open the website. */
export function nativeAppUrl(url, platform) {
  let u
  try { u = new URL(url) } catch { return null }
  const app = APPS[u.hostname.replace(/^www\./, '')]
  if (!app || !platform) return null
  const [pkg, scheme, deep] = app
  const rest = u.host + u.pathname + u.search
  if (platform === 'android') {
    return `intent://${rest}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`
  }
  return deep ? scheme + rest : scheme
}
