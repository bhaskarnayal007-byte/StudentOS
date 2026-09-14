import { useEffect, useState } from 'react'
import TopoField from '@/components/ui/topo-field'

// ─────────────────────────────────────────────────────────────────────────────
// The app-wide topographic backdrop.
//
// Colours are read from the live CSS custom properties rather than hardcoded,
// so this stays correct automatically if the palette in theme.css changes.
//
// It reads the DOM (data-theme + the computed tokens) rather than the store,
// and re-reads on a MutationObserver. That is not indirection for its own
// sake: React runs CHILD effects before PARENT effects, so a child that reads
// tokens in response to a store change always sees the values from *before*
// StoreProvider's effect wrote the new data-theme — the background would stay
// one theme behind. Observing the attribute removes the ordering assumption.
// ─────────────────────────────────────────────────────────────────────────────

// How strong the grid and contour lines are, per theme. Kept low: this sits
// behind real content and must never compete with it.
const STRENGTH = {
  light: { grid: 0.16, line: 0.32 },
  dark: { grid: 0.15, line: 0.5 },
}

function readBackdrop() {
  if (typeof window === 'undefined') {
    return { mode: 'light', paper: '#F3F0EA', ink: '#2E5334' }
  }
  const root = document.documentElement
  const declared = root.dataset.theme
  const mode =
    declared === 'light' || declared === 'dark'
      ? declared
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

  const styles = getComputedStyle(root)
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

  return {
    mode,
    paper: token('--color-base', '#F3F0EA'),
    // Lines use the accent token. This is the one deliberate bend in the
    // "accent = interactive only" rule: at these strengths it reads as a tint
    // of the page, not as something you could click.
    ink: token('--color-accent', '#2E5334'),
  }
}

export default function AppBackground() {
  const [backdrop, setBackdrop] = useState(readBackdrop)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setBackdrop(readBackdrop())

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    media.addEventListener('change', update)
    update()

    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])

  const strength = STRENGTH[backdrop.mode]

  return (
    <div className="app-bg" aria-hidden="true">
      <TopoField
        mode={backdrop.mode}
        paper={backdrop.paper}
        ink={backdrop.ink}
        gridStrength={strength.grid}
        lineStrength={strength.line}
        speed={0.55}
        length={1.15}
        density={1.1}
      />
    </div>
  )
}
