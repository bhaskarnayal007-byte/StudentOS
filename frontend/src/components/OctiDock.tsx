import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Assistant from "./Assistant.jsx";

/**
 * Octi, reachable from anywhere.
 *
 * The assistant used to be a tab you had to go to, which meant leaving
 * whatever you were doing to ask for it. This keeps him in the corner of every
 * screen instead: tap to open a panel with the same chat in it.
 *
 * Deliberately the flat mascot image and not the 3D one — this mounts on every
 * screen, and the WebGL canvas runs an animation loop whether or not anyone is
 * looking at it. The 3D Octi stays on Home, where he is the point.
 */
export default function OctiDock() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // On his own page he is already the whole screen.
  const redundant = pathname === "/octi";

  // Escape closes, like every other overlay on the web.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Moving to another screen closes the panel: leaving it hanging over a page
  // the user deliberately navigated to is never what they meant.
  useEffect(() => setOpen(false), [pathname]);

  if (redundant) return null;

  return (
    <>
      {open && (
        <div className="octi-panel" role="dialog" aria-label="Octi">
          <div className="octi-panel-bar">
            <span>Octi</span>
            <div className="octi-panel-actions">
              {/* The panel is small; the full page is there for a long session. */}
              <button className="ghost always" onClick={() => navigate("/octi")}>
                Open full
              </button>
              <button className="ghost always" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
          </div>
          <Assistant />
        </div>
      )}

      <button
        className={open ? "octi-dock open" : "octi-dock"}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Octi" : "Ask Octi"}
        aria-expanded={open}
      >
        <img src="/mascot.png" alt="" />
      </button>
    </>
  );
}
