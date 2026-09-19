// Pure decision: given what the server has and what this device last agreed
// on, what should sign-in do? Kept apart from cloudSync.js so it can be tested
// without pulling in the Supabase client (and its browser-only env vars).

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
