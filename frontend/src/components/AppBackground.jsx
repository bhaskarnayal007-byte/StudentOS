import TopoField from '@/components/ui/TopoField'
import { useRootStyle } from './mascot/useThemeMode'

// ─────────────────────────────────────────────────────────────────────────────
// The app-wide topographic backdrop.
//
// Colours are read from the live CSS custom properties rather than hardcoded,
// so this stays correct automatically if the palette in theme.css changes.
//
// It reads the DOM (data-theme + the computed tokens) rather than the store,
// through useRootStyle — see there for why reading the store would leave the
// background one theme behind.
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
  const styles = getComputedStyle(root)
  // Every theme in theme.css declares its color-scheme, including Auto's
  // prefers-color-scheme rule, so this is right for any theme id.
  const mode = styles.colorScheme.trim() === 'dark' ? 'dark' : 'light'

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
  const backdrop = useRootStyle(readBackdrop)
  const strength = STRENGTH[backdrop.mode]

  return (
    <div className="app-bg" aria-hidden="true">
      <TopoField
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
