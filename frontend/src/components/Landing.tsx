import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
const OctopusMascot = lazy(() => import("./mascot/OctopusMascot"));

/**
 * What a signed-out visitor sees.
 *
 * Locked to dark whatever the viewer's theme is, so the page the world sees is
 * one deliberate thing rather than two half-tuned ones. The app behind the
 * sign-in still follows their system preference.
 *
 * The collage is real screenshots of the app, not stock photography. Seeded
 * stock returned a pineapple and a padlock, which on a study planner reads as
 * a broken page; the product is more convincing than a stand-in anyway.
 */
export default function Landing() {
  const install = useInstallPrompt();

  return (
    <div className="landing" data-theme="dark">
      <header className="landing-bar">
        <span className="landing-brand">
          <img src="/logo-mark.png" alt="" className="brand-mark" />
          Student OS
        </span>
        <Link to="/signin" className="landing-signin">Sign in</Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <h1>Your term, in one calm place.</h1>
          <p className="landing-lead">
            Deadlines, timetable, notes and money in one app. Tell Octi what
            happened and he files it for you.
          </p>

          <div className="landing-cta">
            <Link to="/signin" className="primary landing-go">Start for free</Link>
            {install && (
              <button className="landing-ghost" onClick={install}>
                Install the app
              </button>
            )}
          </div>
        </div>

        <div className="landing-hero-art">
          <Suspense fallback={<div className="mascot-stage" />}>
            {/* A portrait here, not a button. The CTA above is the thing to press. */}
            <OctopusMascot onClick={() => {}} />
          </Suspense>
        </div>
      </section>

      {/* The collage. Deliberately uneven: three photographs at three different
          heights with two text tiles slotted between them, so the eye moves
          down the column rather than scanning a row of equal cards. */}
      <section className="landing-collage" aria-label="What it looks like to use">
        <figure className="tile tile-tall">
          <img
            src="/shots/phone-tasks.jpg"
            alt="The task list on a phone, with chemistry deadlines filed under their subject"
            loading="lazy"
          />
        </figure>

        <blockquote className="tile tile-quote">
          <p>
            “I spent 180 on lunch and start a 25 minute study timer”
          </p>
          <cite>One message. Octi logs the money and starts the clock.</cite>
        </blockquote>

        <figure className="tile tile-wide">
          <img
            src="/shots/octi-chat-crop.jpg"
            alt="Octi confirming that a task was added and a note saved"
            loading="lazy"
          />
        </figure>

        <div className="tile tile-stat">
          <strong>Sunday night</strong>
          <p>
            Everything due this week on one screen, so the panic arrives on
            time instead of on Monday.
          </p>
        </div>

        <figure className="tile tile-short">
          <img
            src="/shots/notes-crop.jpg"
            alt="A chemistry note kept in the app"
            loading="lazy"
          />
        </figure>
      </section>

      <section className="landing-download" aria-labelledby="get-it">
        <h2 id="get-it">Put it on your phone</h2>
        <p className="landing-sub">
          It installs from the browser. No app store, no account for the
          download, nothing to update by hand.
        </p>

        <div className="install-grid">
          <div className="install-main">
            <h3>On a laptop</h3>
            <p>
              Open the app and use the install control in the address bar. It
              then opens in its own window like anything else on your machine.
            </p>
            {install ? (
              <button className="primary install-go" onClick={install}>
                Install now
              </button>
            ) : (
              <Link to="/signin" className="primary install-go">Open the app</Link>
            )}
          </div>

          <div className="install-side">
            <h3>iPhone</h3>
            <p>Share, then Add to Home Screen.</p>
          </div>

          <div className="install-side">
            <h3>Android</h3>
            <p>Menu, then Install app.</p>
          </div>
        </div>
      </section>

      <section className="landing-close">
        <h2>It is free, and it stays yours.</h2>
        <p>
          Your notes and your spending are visible to you and nobody else. Works
          with no signal and catches up when you are back.
        </p>
        <Link to="/signin" className="primary landing-go">Start for free</Link>
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
 * caught on mount and kept. Returns null where installing isn't offered, so the
 * button simply isn't drawn rather than being drawn and doing nothing.
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
