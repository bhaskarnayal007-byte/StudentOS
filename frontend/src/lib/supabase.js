import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

/** True inside the Android app, false in a browser. */
export const isNative = Capacitor.isNativePlatform()

/** Where Google sends the Android app back to. Registered as an intent
 *  filter in android/app/src/main/AndroidManifest.xml, and has to be listed
 *  under Supabase → Authentication → URL Configuration → Redirect URLs. */
export const NATIVE_AUTH_REDIRECT = 'com.bhaskarnayal.stratus://auth'

// The ANON key, not the service role one. This file ships to the browser, so
// anything here is public — which is fine for the anon key: it can only reach
// rows your Row Level Security policies allow. The service role key stays on
// the backend and would hand anyone your whole database.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Copy .env.example to .env.',
  )
}

// The app gets the sign-in back as a deep link with a one-time ?code=, which
// only the PKCE flow can trade for a session. The web keeps its default.
export const supabase = createClient(url, anonKey, isNative ? { auth: { flowType: 'pkce' } } : undefined)

// Google sign-in in the app runs in a Chrome tab (Google refuses to sign in
// inside a WebView) and returns here through NATIVE_AUTH_REDIRECT. Trading
// the code fires onAuthStateChange, which useSession already listens to.
if (isNative) {
  Promise.all([import('@capacitor/app'), import('@capacitor/browser')]).then(([{ App }, { Browser }]) => {
    App.addListener('appUrlOpen', async ({ url: link }) => {
      if (!link.startsWith(NATIVE_AUTH_REDIRECT)) return
      Browser.close().catch(() => {})
      const code = new URL(link).searchParams.get('code')
      if (code) await supabase.auth.exchangeCodeForSession(code)
    })
  })
}

// Where this app's own backend lives (the AI proxy).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/**
 * The current access token, or null when signed out.
 *
 * Always read it through this rather than caching it: supabase-js refreshes
 * the token in the background, so a copy taken at mount is stale within the
 * hour and every request after that 401s.
 */
export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
