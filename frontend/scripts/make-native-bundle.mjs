// Builds the Android app's web files and publishes them as a live update in dist/native/.
//
// Run after `vite build` (it writes into the web build's dist/). The app reads
// dist/native/manifest.json from the website (src/lib/liveUpdate.js).

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'

const GRADLE = 'android/app/build.gradle'
const OUT = 'dist-native'

if (!existsSync(GRADLE)) {
  // Not fatal: the website deploy must not fail because the Android project isn't there.
  console.warn(`No ${GRADLE}; skipping the Android live update.`)
  process.exit(0)
}

// The APK this bundle is built for. Bump versionCode whenever native code or a
// Capacitor plugin changes, so older APKs stop taking bundles they can't run.
const native = Number(readFileSync(GRADLE, 'utf8').match(/versionCode\s+(\d+)/)[1])
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14)

execSync(`npx vite build --mode native --outDir ${OUT} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, STRATUS_BUILD_ID: version },
})

const files = {}
for (const path of readdirSync(OUT, { recursive: true })) {
  const full = join(OUT, path)
  if (statSync(full).isFile()) files[path.replaceAll('\\', '/')] = readFileSync(full)
}
const zip = zipSync(files, { level: 9 })

mkdirSync('dist/native', { recursive: true })
writeFileSync(`dist/native/${version}.zip`, zip)
writeFileSync(
  'dist/native/manifest.json',
  JSON.stringify({
    version,
    native,
    url: `native/${version}.zip`,
    checksum: createHash('sha256').update(zip).digest('hex'),
  }),
)
console.log(`Android live update ${version} for versionCode ${native}: ${(zip.length / 1e6).toFixed(1)} MB`)
