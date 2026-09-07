import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(url, anonKey)

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
