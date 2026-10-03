import { useEffect } from 'react'

/**
 * Reveals elements as they enter the viewport.
 *
 * Everything marked `data-reveal` starts lowered, blurred and transparent (see
 * theme.css) and settles when it arrives. IntersectionObserver rather than a
 * scroll listener: a scroll handler runs on every frame and reflows the page
 * doing it, which is the usual reason a landing page stutters on a phone.
 *
 * `once: true` by design. Content that re-animates every time it passes the
 * fold is a toy, not a product page.
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const targets = document.querySelectorAll('[data-reveal]:not(.is-in)')
    if (!targets.length) return

    // Honour the setting rather than fighting it: reduced motion means the
    // page arrives already settled, not that it animates faster.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach(el => el.classList.add('is-in'))
      return
    }

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      },
      // Fires a little before the element is fully on screen, so the motion
      // reads as the page settling rather than as a reaction to the scroll.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    targets.forEach(el => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
