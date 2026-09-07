// Regenerates every generated image from the two source artworks.
//   node scripts/make-assets.mjs
//
// Sources (checked in, never modified):
//   src/assets/logo.png        — the app icon: metallic pinwheel on a dark badge
//   src/assets/mascot-src.png  — the AI mascot, rendered on black
//
// Outputs (all in public/):
//   pwa-192.png, pwa-512.png, pwa-maskable-512.png, logo-mark.png, mascot.png
import sharp from "sharp";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — on Windows .pathname yields "/C:/..." and
// leaves spaces percent-encoded, so the path never resolves.
const dir = (p) => fileURLToPath(new URL(p, import.meta.url));
const LOGO = dir("../src/assets/logo.png");
const MASCOT = dir("../src/assets/mascot-src.png");
const OUT = dir("../public/");

// The badge's own background, used to letterbox rather than white bars.
const BADGE_BG = "#0d0d0f";

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
  // guaranteed to survive. This artwork already carries enough margin, and its
  // corners are flat background, so clipping them is invisible.
  await base()
    .resize(512, 512, { fit: "contain", background: BADGE_BG })
    .png()
    .toFile(`${OUT}pwa-maskable-512.png`);

  // The in-app mark is the same badge — it's a designed icon, so unlike the
  // previous artwork there is nothing to key out of it. CSS rounds the corners.
  await base().resize(512, 512, { fit: "contain", background: BADGE_BG })
    .png()
    .toFile(`${OUT}logo-mark.png`);
}

// ─── Mascot ──────────────────────────────────────────────────────────────────
// The render is a white figure on black. To sit on either theme it needs the
// black gone — but a plain "delete every dark pixel" pass would punch out its
// eyes, which are black too. A flood fill from the image border only removes
// dark pixels CONNECTED to the outside, and the eyes are enclosed by the white
// body, so they survive.
// Brightest pixel still treated as background. Measured, not guessed: the
// backdrop sits at 4-9 and the subject's darkest shaded edges are well above
// this. Raising it lets the fill walk in through those shaded edges and eat
// the mascot's tentacles — which is exactly what 76 did.
const DARK_MAX = 52;

/** Pixels this bright are unambiguously the figure, never backdrop or its
 *  cast shadow — used to find where the figure actually is. */
const BODY_MIN = 100;

/** The render includes a soft shadow/reflection on the floor beneath the
 *  figure. It is brighter than DARK_MAX, so the flood fill stops at it and
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
      if (Math.max(data[i], data[i + 1], data[i + 2]) < BODY_MIN) continue;
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
  const isDark = (i) => Math.max(data[i], data[i + 1], data[i + 2]) <= DARK_MAX;

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

const pct = await mascot().then((v) => v);
await icons();
console.log(
  `wrote pwa-192/512, pwa-maskable-512, logo-mark, mascot — mascot background cleared ${pct.toFixed(1)}%`,
);
