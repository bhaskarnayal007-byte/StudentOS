import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
const OctopusMascot = lazy(() => import("./mascot/OctopusMascot"));

/**
 * What a signed-out visitor sees.
 *
 * Until now the app opened straight onto a password field, which tells someone
 * who has never heard of it nothing at all. This says what it is, shows the
 * thing that makes it different, and gets out of the way.
 */
export default function Landing() {
  const install = useInstallPrompt();

  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="landing-brand">
          <img src="/logo-mark.png" alt="" className="brand-mark" />
          Student OS
        </span>
        <Link to="/signin" className="theme-toggle">Sign in</Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <h1>Your term, in one place.</h1>
          <p className="landing-lead">
            Classes, deadlines, that ₹200 you keep spending on coffee — and an
            octopus who files all of it for you while you type one sentence.
          </p>

          <div className="landing-cta">
            <Link to="/signin" className="primary landing-go">Start for free</Link>
            {install && (
              <button className="oauth-btn landing-install" onClick={install}>
                Install the app
              </button>
            )}
          </div>

          <p className="landing-note">
            Free. Works offline. Nothing is shown to anyone but you.
          </p>
        </div>

        <div className="landing-hero-art">
          <Suspense fallback={<div className="mascot-stage" />}>
            {/* On the landing page he is a portrait, not a button — the CTA
                above is the thing to press. */}
            <OctopusMascot onClick={() => {}} />
          </Suspense>
        </div>
      </section>

      <section className="landing-points">
        <article>
          <h2>Tell Octi, don't fill in forms</h2>
          <p>
            "I spent 180 on lunch and start a 25 minute study timer" does both,
            in one message. He asks before he deletes anything.
          </p>
        </article>
        <article>
          <h2>Everything on one screen</h2>
          <p>
            To-dos with due dates, one-off events, your weekly timetable, timers
            and alarms, and where the money went this month.
          </p>
        </article>
        <article>
          <h2>Follows you between devices</h2>
          <p>
            Add a deadline on your laptop, see it on your phone on the bus. Keeps
            working with no signal and catches up when you're back.
          </p>
        </article>
      </section>

      <footer className="landing-foot">
        <span>Student OS</span>
        <Link to="/signin">Sign in</Link>
      </footer>
    </div>
  );
}

/**
 * The browser's own install prompt, if this visit is eligible for one.
 *
 * Chrome fires `beforeinstallprompt` when the app qualifies and the user hasn't
 * installed it. There is no way to ask for that event later, so it has to be
 * caught on mount and kept. Returns null where installing isn't offered —
 * iOS Safari, or an already-installed copy — so the button simply isn't drawn
 * rather than being drawn and doing nothing.
 */
function useInstallPrompt() {
  const [deferred, setDeferred] = useState<Event | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;
  return () => {
    (deferred as Event & { prompt: () => void }).prompt();
    // It can only be used once; drop it so the button disappears after use.
    setDeferred(null);
  };
}
