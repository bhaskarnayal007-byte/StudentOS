// How to delete a Stratus account and its data, at /delete-account. Public, because Google Play links to it.
import { Link } from "react-router-dom";
import LegalPage, { CONTACT } from "./LegalPage";

export default function DeleteAccountPage({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <LegalPage title="Delete your account">
      <p>
        You can delete your Stratus account, and everything stored with it, at any time. You don't
        need the Android app installed to do it.
      </p>

      <h2>In the app or on the website</h2>
      <ol>
        <li>
          {signedIn ? (
            <><Link to="/settings">Open Settings</Link>.</>
          ) : (
            <><Link to="/signin">Sign in</Link> in the Android app or on this website, then open Settings.</>
          )}
        </li>
        <li>
          Under <strong>Account</strong>, tap <strong>Delete account</strong>, type DELETE and confirm.
        </li>
      </ol>

      <h2>By email</h2>
      <p>
        Can't sign in? Email {CONTACT} from the address you signed up with and ask for your account to
        be deleted. We do it within 7 days and reply when it's done.
      </p>

      <h2>What is deleted</h2>
      <p>
        Straight away and for good: your account and email address, your tasks, courses, notes and
        their files, calendar events, schedule, timers, spending, settings, your tag, name and
        profile picture, your friendships, chat messages you sent, and anything shared with you that
        you haven't opened yet.
      </p>
      <p>
        Nothing is kept afterwards. Crash reports we received never contained your data, and are
        removed by our crash-report provider within 90 days.
      </p>
    </LegalPage>
  );
}
