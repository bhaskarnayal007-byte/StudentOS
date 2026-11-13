// The frame every legal page sits in, plus the copyright line shown at the foot of every screen.
import { Link } from "react-router-dom";

// Where the policies promise people can reach us. A link, so it opens their mail app.
const EMAIL = "archive.solutions007@gmail.com";
export const CONTACT = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
const UPDATED = "13 November 2026";

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
 * The grievance officer and complaint deadlines. Stratus hosts chats between
 * users, so India's IT (Intermediary Guidelines) Rules, 2021 apply: a named
 * officer, acknowledgement in 24 hours, resolution in 15 days, and 24-hour
 * removal of intimate or impersonating content. Shown on both policies.
 */
export function Grievance() {
  return (
    <>
      <h2>Complaints and grievance officer</h2>
      <p>
        Our grievance officer is <strong>Bhaskar Nayal</strong>, Chennai, Tamil Nadu, India,{" "}
        {CONTACT}. Write to them about anything in Stratus: content or behaviour that breaks
        these terms or the law, a privacy request, or how your data is handled. Say what the
        problem is and, if it's about content, which chat or user it's in.
      </p>
      <ul>
        <li>We acknowledge every complaint within <strong>24 hours</strong>.</li>
        <li>We resolve it within <strong>15 days</strong> and tell you what we did.</li>
        <li>
          Content that shows someone's private areas, nudity or a sexual act, or impersonates
          someone (including morphed or edited images), is removed or disabled within{" "}
          <strong>24 hours</strong> of a complaint from the person shown or anyone acting for them.
        </li>
      </ul>
    </>
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
