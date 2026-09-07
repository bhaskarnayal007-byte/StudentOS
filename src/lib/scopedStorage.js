// Per-account localStorage keys.
//
// Everything used to live under one key, from when the app had no accounts.
// That meant signing out and in as someone else showed you the previous
// person's tasks and spending — fine for a single-user app, a leak once real
// accounts exist.

export function scopedKey(base, userId) {
  return userId ? `${base}:${userId}` : base
}

/**
 * Read `base` for `userId`, as a raw string, or null.
 *
 * `legacy` names extra pre-account keys to fall back to — older builds of this
 * app stored the same data elsewhere.
 *
 * The first signed-in load is the migration point. An account with nothing of
 * its own adopts whatever pre-account data is lying around; otherwise
 * everyone's existing tasks would vanish the moment they signed in. Either
 * way, the unscoped keys are then cleared.
 *
 * Clearing them even when nothing was adopted is deliberate. Unscoped data
 * predates accounts, so it belongs to whoever used this browser before there
 * were any — exactly one account can inherit it. Leaving the copy behind hands
 * the next person to sign in here a look at the previous person's tasks and
 * spending, which is the bug this module exists to close.
 */
export function readScoped(base, userId, legacy = []) {
  try {
    const own = localStorage.getItem(scopedKey(base, userId))

    // Signed out, nothing may be adopted or cleared: the session simply hasn't
    // loaded yet, and this runs again with a real id once it has.
    if (!userId) return own ?? readFirst(legacy)

    const inherited = own ?? readFirst([base, ...legacy])
    if (own === null && inherited !== null) {
      localStorage.setItem(scopedKey(base, userId), inherited)
    }

    for (const key of [base, ...legacy]) localStorage.removeItem(key)

    return inherited
  } catch {
    // Private mode can refuse storage entirely.
    return null
  }
}

function readFirst(keys) {
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value !== null) return value
  }
  return null
}

export function writeScoped(base, userId, value) {
  try {
    localStorage.setItem(scopedKey(base, userId), value)
  } catch {
    // Nothing useful to do — the app keeps working, it just won't persist.
  }
}
