// The decisions behind sync — what sign-in should do, and whether a push has
// anything to send. Kept apart from cloudSync.js so they can be tested without
// pulling in the Supabase client (and its browser-only env vars).

/**
 * Decide what to do on sign-in, given what the server has and what this device
 * last agreed on.
 *
 * Pure so it can be tested without a network: see scripts/test-cloud-sync.mjs.
 */
export function reconcile({ remote, localRev, hasLocalData }) {
  // The fetch failed. Touch nothing; a later push will carry local edits up.
  if (remote === undefined) return { action: 'wait' }

  // Nothing on the server yet. Whatever this device has becomes the account's
  // state — this is also the localStorage-to-cloud migration for existing users.
  if (remote === null) return hasLocalData ? { action: 'push' } : { action: 'none' }

  // The server has a revision this device has never seen: another device wrote
  // it. Adopt it. Local edits made offline since localRev lose — the cost of
  // syncing whole documents, written down in the migration file.
  if (remote.rev > localRev) return { action: 'adopt' }

  // This device is level with the server, or ahead of it because its own last
  // push never landed. Either way, send ours.
  return { action: 'push' }
}

/** Fields that are this device's business, not the account's. */
export const DEVICE_ONLY = ['theme', 'ownerId']

/**
 * The account's part of `state` as one string, equal for equal content. Keys
 * are sorted because jsonb hands rows back in its own key order, and a reload
 * that changed nothing has to compare equal to what the server sent.
 */
export function wireKey(state) {
  const copy = { ...state }
  for (const key of DEVICE_ONLY) delete copy[key]
  return JSON.stringify(copy, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
      : v,
  )
}

// What the server is known to hold, per account: set by a push that landed or
// by data read back from the server — never by a failed push, so that one is
// still retried even if nothing changes afterwards.
const onServer = new Map()

export function markOnServer(userId, state) {
  onServer.set(userId, wireKey(state))
}

/** True when sending `state` would change nothing on the server — a theme
 *  toggle, UI-only state, or a remote change we just applied. */
export function isOnServer(userId, state) {
  return onServer.get(userId) === wireKey(state)
}
