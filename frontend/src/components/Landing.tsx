import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
const OctopusMascot = lazy(() => import("./mascot/OctopusMascot"));

/** The showcase strip. Real screens, no mockup frames, no invented UI. */
const SCREENS = [
  { src: "/shots/screen-home.jpg", label: "Home", alt: "The home screen, with tasks, spending and a timer around Octi" },
  { src: "/shots/screen-courses.jpg", label: "Courses", alt: "Subjects listed with how much is still open in each" },
  { src: "/shots/screen-notes.jpg", label: "Notes", alt: "A chemistry note kept in the app" },
  { src: "/shots/screen-timers.jpg", label: "Focus", alt: "The timer, with the week of focus sessions below it" },
];

/** What the app actually does. Dense on purpose: the page used to say almost
 *  nothing, and a student deciding in ten seconds wants the whole list. */
const DOES: [string, string][] = [
  ["Deadlines", "To-dos with dates and priorities, sorted so the next thing is first."],
  ["Timetable", "Your weekly blocks, and what is on now or next."],
  ["Subjects", "Every task and note filed under the course it belongs to."],
  ["Notes", "Lecture notes kept per subject, editable in place."],
  ["Focus", "A timer that logs the session, and a week you can look back at."],
  ["Spending", "What went where this month, by category."],
  ["Octi", "Tell him in a sentence. He does it, and says what he touched."],
  ["Offline", "Keeps working with no signal, catches up when you are back."],
];

/**
 * What a signed-out visitor sees.
 *
 * Locked to dark whatever the viewer's theme is, so the page the world sees is
 * one deliberate thing rather than two half-tuned ones. The app behind the
 * sign-in still follows their system preference.
 *
 * Built as full-width bands with an inner .wrap, not one narrow column: the
 * previous version put everything inside a 1180px box and the page was mostly
 * margin. Every image is a real screenshot of the app.
 */
export default function Landing() {
  const install = useInstallPrompt();

  return (
    <div className="landing" data-theme="dark">
      <header className="landing-bar">
        <div className="wrap landing-bar-inner">
          <span className="landing-brand">
            <img src="/logo-mark.png" alt="" className="brand-mark" />
            Student OS
          </span>
          <Link to="/signin" className="landing-signin">Sign in</Link>
        </div>
      </header>

      {/* Full bleed, and tall enough to be a moment rather than a banner. */}
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <Suspense fallback={null}>
            <OctopusMascot onClick={() => {}} />
          </Suspense>
        </div>

        <div className="wrap hero-copy">
          <h1>Your term, handled.</h1>
          <p className="hero-lead">
            Deadlines, timetable, notes and money in one place. Tell Octi what
            happened and he files it.
          </p>
          <Link to="/signin" className="btn-solid">Start for free</Link>
          <p className="hero-fine">Free. No card. Works offline.</p>
        </div>
      </section>

      {/* Runs off the right edge on purpose: there is more than fits, and the
          cut edge is what says so. */}
      <section className="showcase" aria-label="The app">
        <div className="wrap">
          <h2>Four screens, no setup.</h2>
        </div>
        <ul className="screens">
          {SCREENS.map((s) => (
            <li key={s.src}>
              <img src={s.src} alt={s.alt} loading="lazy" />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>One sentence does the filing.</h2>
          <div className="say-grid">
            <figure className="say-shot">
              <img
                src="/shots/octi-chat-crop.jpg"
                alt="Octi confirming he added a task and saved a note, with both tools listed"
                loading="lazy"
              />
            </figure>
            <div className="say-text">
              <p>
                Octi runs the app the way you would. He picks the date, the
                subject and the category himself, then shows you exactly which
                parts of the app he touched.
              </p>
              <p className="say-note">He asks first before deleting anything.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap does">
        <h2>What you get</h2>
        <ul className="does-grid">
          {DOES.map(([name, line]) => (
            <li key={name}>
              <h3>{name}</h3>
              <p>{line}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" id="get-it">
        <div className="wrap">
          <h2>Put it on your phone</h2>
          <p className="band-lead">
            It installs from the browser. No app store, nothing to update by hand.
          </p>

          <div className="install-grid">
            <div className="install-main">
              <h3>On a laptop</h3>
              <p>
                Use the install control in the address bar. It then opens in its
                own window like anything else on your machine.
              </p>
              {install ? (
                <button className="btn-solid install-go" onClick={install}>
                  Install now
                </button>
              ) : (
                <Link to="/signin" className="btn-solid install-go">Open the app</Link>
              )}
            </div>

            <figure className="install-phone">
              <img
                src="/shots/phone-tasks.jpg"
                alt="The task list on a phone, with chemistry deadlines filed under their subject"
                loading="lazy"
              />
            </figure>

            <div className="install-steps">
              <div>
                <h3>iPhone</h3>
                <p>Share, then Add to Home Screen.</p>
              </div>
              <div>
                <h3>Android</h3>
                <p>Menu, then Install app.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap closer">
        <h2>It is free, and it stays yours.</h2>
        <p>Your notes and your spending are visible to you and nobody else.</p>
        <Link to="/signin" className="btn-solid">Start for free</Link>
      </section>

      <footer className="landing-foot">
        <div className="wrap landing-foot-inner">
          <span>Student OS</span>
          <Link to="/signin">Sign in</Link>
        </div>
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
