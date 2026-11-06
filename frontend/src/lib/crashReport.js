// Sends crashes to Sentry when VITE_SENTRY_DSN is set, and does nothing when it isn't.
//
// Without this, a crash on someone else's phone is invisible: ErrorBoundary
// shows them a message and we never hear about it. The SDK is fetched only
// when a DSN is configured, so local builds without one download nothing.
// ponytail: errors thrown before the SDK finishes loading (~first second)
// aren't reported; switch to a static import if startup crashes go missing.

const dsn = import.meta.env.VITE_SENTRY_DSN

// The privacy policy promises error reports carry no notes, tasks or chats.
// Console logs and request URLs can, so those breadcrumbs never leave the device.
const PRIVATE_BREADCRUMBS = new Set(['console', 'fetch', 'xhr'])

const sentry = dsn
  ? import('@sentry/browser').then(Sentry => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        beforeBreadcrumb: crumb => (PRIVATE_BREADCRUMBS.has(crumb.category) ? null : crumb),
      })
      return Sentry
    })
  : null

/** Reports an error React caught (Sentry already sees uncaught ones on its own). */
export function reportCrash(error, componentStack) {
  sentry?.then(Sentry => Sentry.captureException(error, { extra: { componentStack } }))
}
