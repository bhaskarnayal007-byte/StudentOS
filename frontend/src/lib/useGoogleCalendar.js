import { useCallback, useEffect, useState } from 'react'
import { toKey } from '../dates.js'

/**
 * Read-only Google Calendar, entirely in the browser.
 *
 * Google Identity Services hands us an access token from a popup, so this
 * works whether the account signed in with email or with Google, and never
 * navigates away. The token lives an hour; after that the UI offers
 * "Reconnect". Events are only held in memory for display — never written to
 * the store, localStorage or Supabase.
 *
 * ponytail: primary calendar only, no refresh token. Add calendarList for
 * other calendars, and a server-held refresh token if hourly reconnects annoy.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const STORE_KEY = 'gcal-token'

function readToken() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY)) // { token, exp } or null
  } catch { return null }
}
function writeToken(value) {
  try {
    if (value) sessionStorage.setItem(STORE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORE_KEY)
  } catch { /* private mode: stays connected until reload */ }
}

let gisLoading = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => { gisLoading = null; reject(new Error("Couldn't reach Google. Check your connection.")) }
    document.head.appendChild(s)
  })
  return gisLoading
}

const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** One Google event → the calendar's item shape. All-day events can span
 *  days, so this returns one item per day they cover. */
function toItems(ev) {
  const base = { title: ev.summary || '(No title)', source: 'google', link: ev.htmlLink }
  if (ev.start?.date) {
    const out = []
    const [y, m, d] = ev.start.date.split('-').map(Number)
    const end = ev.end?.date || ev.start.date
    for (let day = new Date(y, m - 1, d); toKey(day) < end || out.length === 0; day.setDate(day.getDate() + 1)) {
      out.push({ ...base, id: `g-${ev.id}-${toKey(day)}`, date: toKey(day), time: '', allDay: true })
    }
    return out
  }
  const start = new Date(ev.start.dateTime)
  const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : null
  return [{
    ...base,
    id: `g-${ev.id}`,
    date: toKey(start),
    time: hhmm(start),
    // A timed event running past midnight is drawn to the end of its first day.
    endTime: end && toKey(end) === toKey(start) ? hhmm(end) : end ? '24:00' : '',
    allDay: false,
  }]
}

/** `from` and `to` are inclusive "YYYY-MM-DD" keys for the visible range. */
export default function useGoogleCalendar(from, to) {
  const [auth, setAuth] = useState(readToken)
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')

  const expired = auth && auth.exp <= Date.now()
  const status = !auth ? 'off' : expired ? 'expired' : 'connected'

  // Flip to "expired" on the dot rather than waiting for a failed fetch.
  useEffect(() => {
    if (status !== 'connected') return
    const id = setTimeout(() => setAuth(a => (a ? { ...a } : a)), auth.exp - Date.now() + 50)
    return () => clearTimeout(id)
  }, [status, auth])

  useEffect(() => {
    if (status !== 'connected') { setEvents([]); return }
    const ctrl = new AbortController()
    const [fy, fm, fd] = from.split('-').map(Number)
    const [ty, tm, td] = to.split('-').map(Number)
    const params = new URLSearchParams({
      timeMin: new Date(fy, fm - 1, fd).toISOString(),
      timeMax: new Date(ty, tm - 1, td + 1).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: ctrl.signal,
    })
      .then(async res => {
        if (res.status === 401) { setAuth({ ...auth, exp: 0 }); return }
        if (!res.ok) throw new Error(`Google Calendar said ${res.status}.`)
        const body = await res.json()
        setEvents((body.items || []).filter(e => e.status !== 'cancelled').flatMap(toItems))
        setError('')
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => ctrl.abort()
  }, [status, auth, from, to])

  const connect = useCallback(async () => {
    setError('')
    try {
      await loadGis()
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: resp => {
          if (resp.error) { setError("Google didn't grant calendar access."); return }
          const next = { token: resp.access_token, exp: Date.now() + (Number(resp.expires_in) - 60) * 1000 }
          writeToken(next)
          setAuth(next)
        },
        error_callback: () => setError('The Google window was closed.'),
      }).requestAccessToken()
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (auth?.token) window.google?.accounts?.oauth2?.revoke(auth.token)
    writeToken(null)
    setAuth(null)
  }, [auth])

  return { status, events, connect, disconnect, error, available: Boolean(GOOGLE_CLIENT_ID) }
}
