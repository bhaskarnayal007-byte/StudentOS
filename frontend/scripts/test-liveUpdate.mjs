// Checks when the Android app takes a published live update.
import assert from 'node:assert/strict'

import { isNewerForThisApp } from '../src/lib/liveUpdate.js'

const latest = { version: '20261106120000', native: 3 }

assert.equal(isNewerForThisApp(latest, '20261105090000', '3'), true, 'newer bundle, same APK')
assert.equal(isNewerForThisApp(latest, '20261106120000', '3'), false, 'same version')
assert.equal(isNewerForThisApp(latest, '20261107000000', '3'), false, 'older bundle')
assert.equal(isNewerForThisApp(latest, '20261105090000', '2'), false, 'built for another APK')
assert.equal(isNewerForThisApp(null, '20261105090000', '3'), false, 'unreadable manifest')

console.log('liveUpdate: ok')
