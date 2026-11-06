// Keeps the Android app's web files current between Play Store releases.
//
// The APK ships a copy of dist/, so without this every bug fix waits for a
// Play review. Each web deploy also publishes the Android build as
// native/manifest.json + native/<version>.zip (scripts/make-native-bundle.mjs).
// On launch the app downloads a newer zip, and @capgo/capacitor-updater swaps
// it in the next time the app is backgrounded or restarted.
// ponytail: full zip per update (~2–3 MB); Capgo's delta uploads if that hurts on mobile data.

import { Capacitor } from '@capacitor/core'

// ?. so the node test can import this file outside Vite.
const BASE = import.meta.env?.VITE_UPDATE_URL

export async function checkForLiveUpdate() {
  if (!Capacitor.isNativePlatform()) return
  const [{ CapacitorUpdater }, { App }] = await Promise.all([
    import('@capgo/capacitor-updater'),
    import('@capacitor/app'),
  ])

  // "This bundle started fine." A bundle that never says so within 10 s is
  // rolled back to the previous one on the next launch, so a broken update
  // can't brick the app.
  await CapacitorUpdater.notifyAppReady()
  if (!BASE) return

  try {
    const res = await fetch(new URL('native/manifest.json', BASE), { cache: 'no-store' })
    if (!res.ok) return
    const latest = await res.json()
    const { build } = await App.getInfo()
    if (!isNewerForThisApp(latest, import.meta.env.VITE_BUILD_ID, build)) return

    // Already downloaded, waiting to apply, or rolled back after failing:
    // fetching it again would retry a bad update on every launch.
    const { bundles } = await CapacitorUpdater.list()
    if (bundles.some(b => b.version === latest.version)) return

    const bundle = await CapacitorUpdater.download({
      url: new URL(latest.url, BASE).href,
      version: latest.version,
      checksum: latest.checksum,
    })
    await CapacitorUpdater.next({ id: bundle.id })
  } catch (error) {
    // Offline or the site is down: this copy keeps working, try next launch.
    console.warn('Live update check failed:', error)
  }
}

/**
 * Whether a published bundle should replace the running one. Versions are
 * UTC build timestamps (YYYYMMDDHHMMSS), so string order is time order. A
 * bundle built for a different APK (native) may need native code this one
 * doesn't have, so it waits for the Play Store update instead.
 */
export function isNewerForThisApp(latest, runningVersion, nativeBuild) {
  return String(latest?.native) === String(nativeBuild) && String(latest?.version) > String(runningVersion)
}
