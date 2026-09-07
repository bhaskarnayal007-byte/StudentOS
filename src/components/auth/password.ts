// ─────────────────────────────────────────────────────────────────────────────
// Password hashing for the local gate.
//
// READ THIS BEFORE TRUSTING IT: this is a client-side lock on a client-side
// app. Everything needed to check the password ships to the browser, and the
// data it guards sits in localStorage in plain text. Anyone with devtools can
// read that data without ever seeing the password. This raises the effort of
// casual access on a shared laptop; it is not authentication and it is not
// encryption. Real protection needs a server that refuses to hand over data.
//
// Given that, we still do the storage properly: PBKDF2 with a per-install
// random salt, so the stored value doesn't reveal the password itself (people
// reuse passwords, and that leak would be real even though this gate isn't).
// ─────────────────────────────────────────────────────────────────────────────

const ITERATIONS = 150_000;
const KEY_BITS = 256;

export type Credential = { salt: string; hash: string };

const toBase64 = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

/** crypto.subtle exists only in secure contexts — https, or localhost. */
function hasSubtle() {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

export function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (!hasSubtle()) return weakFallback(password, salt);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return toBase64(bits);
}

export async function createCredential(password: string): Promise<Credential> {
  const salt = randomSalt();
  return { salt, hash: await hashPassword(password, salt) };
}

export async function verifyPassword(password: string, credential: Credential) {
  const attempt = await hashPassword(password, credential.salt);
  return timingSafeEqual(attempt, credential.hash);
}

/** Compares in constant time. Barely matters for a local gate, but a
 *  short-circuiting === on a secret is a habit worth not forming. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Served over plain http on a LAN address, crypto.subtle is unavailable. This
 *  keeps the app usable rather than locking the user out entirely — it is NOT
 *  a real hash, which is exactly why it is namespaced as weak. */
function weakFallback(password: string, salt: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const input = `${salt}::${password}`;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + input.charCodeAt(i) * (i + 1), 2246822519) >>> 0;
  }
  return `weak:${h1.toString(36)}${h2.toString(36)}`;
}
