// The frame every legal page sits in, plus the copyright line shown at the foot of every screen.
import { Link } from "react-router-dom";

// Where the policies promise people can reach us. A link, so it opens their mail app.
const EMAIL = "archive.solutions007@gmail.com";
export const CONTACT = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
const UPDATED = "6 November 2026";

/** The copyright line shown at the foot of every screen. */
export function Copyright() {
  return (
    <p className="copyright">
      © 2026 Stratus · Created by Bhaskar Nayal ·{" "}
      <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
    </p>
  );
}

/**
 * Legal pages are written to match what the code actually does — if a new
 * feature sends data somewhere new, the privacy policy has to change with it.
 */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link to="/" className="legal-back">← Stratus</Link>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      {children}
      <Copyright />
    </main>
  );
}
