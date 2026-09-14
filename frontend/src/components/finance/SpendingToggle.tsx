/**
 * A standalone card in the sidebar column, separate from the app-launcher
 * list — it opens a feature of this app, not an external site, so grouping it
 * with the shortcuts would have mis-labelled what it does.
 */
export default function SpendingToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={open ? "fin-toggle active" : "fin-toggle"}
      onClick={onToggle}
      aria-expanded={open}
      aria-label="Finance dashboard"
    >
      {/* The dollar sign is set in the app's serif rather than drawn as an
          icon, so it matches the rest of the typography exactly. */}
      <span className="fin-toggle-icon" aria-hidden="true">
        $
      </span>
      <span className="fin-toggle-label">Finance</span>
    </button>
  );
}
