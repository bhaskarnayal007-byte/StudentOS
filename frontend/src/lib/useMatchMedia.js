import { useEffect, useState } from 'react'

/** True while the media query matches, following it as the window changes. */
export function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

/** The phone breakpoint used across the app's CSS. */
export const PHONE = '(max-width: 620px)'
