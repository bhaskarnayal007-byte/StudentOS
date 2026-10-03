import { useEffect, useState } from 'react'
import { supabase, API_URL } from '../lib/supabase.js'

/**
 * The signed-in session, or null. `loading` is true until we've checked.
 *
 * That third state matters: a session lives in localStorage and is read back
 * asynchronously, so for the first moment after a refresh we genuinely don't
 * know yet. Without `loading` the app renders the login screen for a frame and
 * then swaps — a visible flash on every reload.
 */
export function useSession() {
  // Annotated because this file is JS but .ts consumers import it: without a
  // type, `useState(null)` infers `never` and every `session.user` is an error.
  const [session, setSession] = useState(
    /** @type {import('@supabase/supabase-js').Session | null} */ (null),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Fires on sign-in, sign-out, and every background token refresh, which is
    // what keeps this in step with a token supabase-js rotated on its own.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading }
}

/**
 * Hand off to Google. This navigates away and comes back to the app with a
 * session already established, so there is nothing to await here — the return
 * trip is handled by onAuthStateChange above like any other sign-in.
 */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      // Without this Google stops issuing a refresh token on the second and
      // later sign-ins, which is what the Calendar sync needs server-side.
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}

/**
 * Permanently delete the signed-in account, then wipe what this browser holds
 * for it: its localStorage keys (scoped by user id) and the PDF store.
 */
export async function deleteAccount() {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) throw new Error('Signed out — sign in again first.')

  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null)
  if (!res?.ok) throw new Error("Couldn't delete your account. Check your connection and try again.")

  // The user no longer exists server-side, so only clear the local session.
  await supabase.auth.signOut({ scope: 'local' })
  try {
    Object.keys(localStorage)
      .filter(k => k.endsWith(`:${session.user.id}`))
      .forEach(k => localStorage.removeItem(k))
    indexedDB.deleteDatabase('student-os-pdfs')
  } catch { /* private mode */ }
}

export function signOut() {
  return supabase.auth.signOut()
}
