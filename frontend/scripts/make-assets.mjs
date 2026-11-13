// Regenerates every generated image from the two source artworks.
//   node scripts/make-assets.mjs
//
// Sources (checked in, never modified):
//   src/assets/logo.png        — the app icon: a white ship's wheel on near-black
//   src/assets/mascot-src.png  — the AI mascot, white on a navy backdrop with a blue glow
//
// Outputs (all in public/):
//   pwa-192.png, pwa-512.png, pwa-maskable-512.png, mascot.png
// Play Store listing (in play-store/, not shipped with the site):
//   icon-512.png, feature-graphic-1024x500.png
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

// fileURLToPath, not .pathname — on Windows .pathname yields "/C:/..." and
// leaves spaces percent-encoded, so the path never resolves.
const dir = (p) => fileURLToPath(new URL(p, import.meta.url));
const LOGO = dir("../src/assets/logo.png");
const MASCOT = dir("../src/assets/mascot-src.png");
const OUT = dir("../public/");
const PLAY = dir("../play-store/");

// The badge's own background, used to letterbox rather than white bars.
const BADGE_BG = "#090408";

async function icons() {
  // No .trim(): trimming crops the margin the badge was drawn with and shoves
  // it to the frame edges. The source is already composed as an app icon, so
  // it only needs scaling.
  //
  // (Careful when checking this: sharp's .metadata() reports the INPUT image,
  // so it will happily tell you .trim() changed nothing. Compare the outputs.)
  const base = () => sharp(LOGO).flatten({ background: BADGE_BG });

  for (const size of [192, 512]) {
    await base()
      .resize(size, size, { fit: "contain", background: BADGE_BG })
      .png()
      .toFile(`${OUT}pwa-${size}.png`);
  }

  // Maskable: Android crops to its own shape and only the middle ~80% is
  // guaranteed to survive. The wheel's handles reach right to that line, so it
  // gets shrunk to 400px and padded back out to 512.
  await base()
    .resize(400, 400, { fit: "contain", background: BADGE_BG })
    .extend({ top: 56, bottom: 56, left: 56, right: 56, background: BADGE_BG })
    .png()
    .toFile(`${OUT}pwa-maskable-512.png`);

  // The in-app mark (header, login) uses pwa-512.png itself: it's the same
  // badge, and one file means the install caches it once. CSS rounds the corners.
}

// ─── Mascot ──────────────────────────────────────────────────────────────────
// The render is a white figure on black. To sit on either theme it needs the
// black gone — but a plain "delete every dark pixel" pass would punch out its
// eyes, which are black too. A flood fill from the image border only removes
// dark pixels CONNECTED to the outside, and the eyes are enclosed by the white
// body, so they survive.
// Background test is the RED channel, not overall brightness: the backdrop
// is navy and the glow around Octi is saturated blue, so both are bright in
// blue but low in red, while the body is white or lavender — high in all
// three. Keying on brightness left the glow behind as a blue halo.
const RED_MAX = 125;

/** Pixels this bright are unambiguously the figure, never backdrop or its
 *  cast shadow — used to find where the figure actually is. */
const BODY_MIN = 150;

/** The render includes a soft shadow/reflection on the floor beneath the
 *  figure. It is brighter than RED_MAX, so the flood fill stops at it and
 *  leaves a dark smear hanging below the mascot. Cropping to the figure's own
 *  bounds first removes it outright — much simpler than trying to key a soft
 *  gradient out by colour. */
async function figureBounds() {
  const { data, info } = await sharp(MASCOT).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (x + y * width) * channels;
      if (data[i] < BODY_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // A little margin so the figure's soft edge isn't sliced flat.
  const pad = 10;
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(height, maxY + pad) - Math.max(0, minY - pad),
  };
}

async function mascot() {
  const { data, info } = await sharp(MASCOT)
    .extract(await figureBounds())
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const isDark = (i) => data[i] <= RED_MAX;

  // Iterative, not recursive — a recursive fill blows the stack at this size.
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, width - 1 + y * width);

  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !isDark(p * 4)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;

    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  // Feather the cut: a hard threshold leaves a dark fringe from the render's
  // own soft edge, which is obvious against a light surface. Averaging alpha
  // over 3x3 softens it by a pixel.
  const alpha = new Uint8Array(width * height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = data[p * 4 + 3];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = x + y * width;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) sum += alpha[p + dx + dy * width];
      }
      data[p * 4 + 3] = Math.round(sum / 9);
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .trim() // drop the huge empty margin around the small figure
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${OUT}mascot.png`);

  const cleared = seen.reduce((n, v) => n + v, 0);
  return (cleared / (width * height)) * 100;
}

// Play wants a 512×512 32-bit PNG (with alpha) and a 1024×500 feature
// graphic. Same badge as the PWA icon; the alpha channel is just opaque.
async function playStore() {
  await mkdir(PLAY, { recursive: true });
  await sharp(LOGO)
    .flatten({ background: BADGE_BG })
    .resize(512, 512, { fit: "contain", background: BADGE_BG })
    .ensureAlpha()
    .png()
    .toFile(`${PLAY}icon-512.png`);

  const logo = await sharp(LOGO).flatten({ background: BADGE_BG }).resize(260, 260).png().toBuffer();
  const octi = await sharp(`${OUT}mascot.png`).resize(300, 300).png().toBuffer();
  // Text is drawn by sharp's SVG renderer with the system's sans-serif.
  const words = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
    <text x="380" y="235" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="92" font-weight="700" fill="#ffffff">Stratus</text>
    <text x="384" y="290" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#b9b2c4">Your semester, organised.</text>
    <text x="384" y="328" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#b9b2c4">Octi does the busywork.</text>
  </svg>`);
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: BADGE_BG } })
    .composite([
      { input: logo, left: 90, top: 120 },
      { input: words, left: 0, top: 0 },
      { input: octi, left: 704, top: 110 },
    ])
    .png()
    .toFile(`${PLAY}feature-graphic-1024x500.png`);
}

const pct = await mascot().then((v) => v);
await icons();
await playStore();
console.log(
  `wrote pwa-192/512, pwa-maskable-512, mascot, play-store/ — mascot background cleared ${pct.toFixed(1)}%`,
);
