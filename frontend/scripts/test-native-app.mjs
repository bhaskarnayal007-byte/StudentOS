import assert from "node:assert/strict";
import { nativeAppUrl, phonePlatform } from "../src/lib/nativeApp.js";

// Android: intent URL with the package and the website as fallback.
assert.equal(
  nativeAppUrl("https://mail.google.com/mail/u/0/", "android"),
  "intent://mail.google.com/mail/u/0/#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F0%2F;end",
);
// www. is ignored when matching.
assert.match(nativeAppUrl("https://www.notion.so/page", "android"), /package=notion\.id;/);

// iOS: the app's scheme, with the path only where the app understands it.
assert.equal(nativeAppUrl("https://mail.google.com/mail/u/0/", "ios"), "googlegmail://");
assert.equal(nativeAppUrl("https://docs.google.com/document/d/abc", "ios"), "googledocs://docs.google.com/document/d/abc");

// Unknown site, desktop, or junk: open the website as before.
assert.equal(nativeAppUrl("https://example.com", "android"), null);
assert.equal(nativeAppUrl("https://mail.google.com", null), null);
assert.equal(nativeAppUrl("not a url", "ios"), null);

assert.equal(phonePlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 }), "android");
assert.equal(phonePlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", maxTouchPoints: 5 }), "ios");
assert.equal(phonePlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", maxTouchPoints: 5 }), "ios");
assert.equal(phonePlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", maxTouchPoints: 0 }), null);

console.log("native app links ok");
