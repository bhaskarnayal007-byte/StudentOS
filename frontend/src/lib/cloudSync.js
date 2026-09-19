// Keeping one account's state the same on every device it signs in on.
//
// localStorage stays the working copy — the app reads and writes it exactly as
// before, so it still works with no network. This layer mirrors that copy into
// the `user_state` row in Supabase and listens for changes other devices make.
//
// The unit of sync is the whole state object. See the note in
// supabase/migrations/0001_user_state.sql for why, and what it costs.

import { supabase } from './supabase.js'

const TABLE = 'user_state'
// The revision we last agreed on with the server, per account. Held next to
// the data itself so a reload knows whether the local copy is ahead of the
// server or just an old echo of it.
const REV_KEY = base => `${base}:rev`

export function readRev(userId) {
  try {
    return Number(localStorage.getItem(REV_KEY(userId))) || 0
  } catch {
    return 0
  }
}

function writeRev(userId, rev) {
  try {
    localStorage.setItem(REV_KEY(userId), String(rev))
  } catch { /* private mode */ }
}

/** Fields that are this device's business, not the account's. */
const DEVICE_ONLY = ['theme', 'ownerId']

function forWire(state) {
  const copy = { ...state }
  for (const key of DEVICE_ONLY) delete copy[key]
  return copy
}

/**
 * Fetch the account's row.
 *
 * Returns { data, rev } when there is one, null when the account has never
 * synced, and undefined when the fetch failed — which is not the same thing:
 * an offline first load must not be read as "this account is empty" and
 * overwrite the server with a blank state once the network returns.
 */
export async function pull(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, rev')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return undefined
  return data ? { data: data.data, rev: Number(data.rev) } : null
}

/** Write the local state up as the newest revision. Resolves to the new rev,
 *  or null if it didn't land — the caller keeps the local copy either way. */
export async function push(userId, state) {
  // Date.now() rather than a counter: two devices that have both been offline
  // come back with revisions that still order sensibly against each other.
  const rev = Date.now()
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: forWire(state), rev, updated_at: new Date().toISOString() })

  if (error) return null
  writeRev(userId, rev)
  return rev
}

/**
 * Call `onRemote(state, rev)` when another device writes this account's row.
 * Returns an unsubscribe function.
 */
export function subscribe(userId, onRemote) {
  const channel = supabase
    .channel(`user_state:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      payload => {
        const row = payload.new
        if (!row) return
        const rev = Number(row.rev)
        // Our own write comes back through the same channel; ignore it.
        if (rev <= readRev(userId)) return
        writeRev(userId, rev)
        onRemote(row.data, rev)
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export { reconcile } from './reconcile.js'

export { DEVICE_ONLY, writeRev }
