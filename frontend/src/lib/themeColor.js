/**
 * Paints the phone's status bar and system bars the colour of the page.
 *
 * Android (and iOS in standalone) colours them from <meta name="theme-color">.
 * It was a fixed green, so every theme had mismatched strips top and bottom.
 * The landing page is always its own near-black, whatever the theme.
 */
export function syncThemeColor() {
  const color = document.querySelector('.landing')
    ? '#14150F'
    : getComputedStyle(document.documentElement).getPropertyValue('--color-base').trim()
  if (!color) return
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.content = color
}
