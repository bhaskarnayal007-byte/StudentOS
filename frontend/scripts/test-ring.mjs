import assert from "node:assert/strict";

// Android Chrome: permission granted, but the Notification constructor throws.
// This is what blanked the app when a timer finished.
let shown = 0;
globalThis.Notification = class {
  static permission = "granted";
  constructor() { throw new TypeError("Failed to construct 'Notification': Illegal constructor."); }
};
const setNavigator = (value) => Object.defineProperty(globalThis, "navigator", { value, configurable: true });

const { ring } = await import("../src/useNow.js");

// No service worker: falls back to the constructor, which throws. Must not escape.
setNavigator({});
assert.doesNotThrow(() => ring("Timer finished"));

// Service worker present: notifies through it, which phones allow.
setNavigator({ serviceWorker: { getRegistration: async () => ({ showNotification: async () => { shown++; } }) } });
assert.doesNotThrow(() => ring("Timer finished"));
await new Promise((r) => setTimeout(r, 0));
assert.equal(shown, 1);

// Service worker lookup fails: still nothing escapes, sync or async.
let unhandled = null;
process.on("unhandledRejection", (e) => { unhandled = e; });
setNavigator({ serviceWorker: { getRegistration: async () => { throw new Error("no sw"); } } });
assert.doesNotThrow(() => ring("Alarm"));
await new Promise((r) => setTimeout(r, 10));
assert.equal(unhandled, null);

console.log("ring: ok");
