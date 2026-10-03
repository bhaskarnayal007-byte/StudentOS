import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../lib/useReveal.js";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
const OctopusMascot = lazy(() => import("./mascot/OctopusMascot"));

/** The showcase. Real screens, no mockup frames, no invented UI. */
const SCREENS = [
  { src: "/shots/screen-home.jpg", label: "Home", alt: "The home screen, with tasks, spending and a timer around Octi" },
  { src: "/shots/screen-courses.jpg", label: "Courses", alt: "Subjects listed with how much is still open in each" },
  { src: "/shots/screen-notes.jpg", label: "Notes", alt: "A chemistry note kept in the app" },
  { src: "/shots/screen-timers.jpg", label: "Focus", alt: "The timer, with the week of focus sessions below it" },
];

/** What the app actually does. Dense on purpose: a student deciding in ten
 *  seconds wants the whole list, not three adjectives. */
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

/** The pill CTA. The arrow lives in its own circle flush to the right inner
 *  padding, and leans out on hover, which is what makes the press feel like a
 *  mechanism rather than a link. */
function Cta({ to, onClick, children }: { to?: string; onClick?: () => void; children: React.ReactNode }) {
  const inner = (
    <>
      <span>{children}</span>
      <span className="cta-arrow" aria-hidden="true">↗</span>
    </>
  );

  return onClick ? (
    <button className="cta" onClick={onClick}>{inner}</button>
  ) : (
    <Link className="cta" to={to ?? "/signin"}>{inner}</Link>
  );
}

/**
 * What a signed-out visitor sees.
 *
 * Locked to dark whatever the viewer's theme is, so the page the world sees is
 * one deliberate thing rather than two half-tuned ones. The app behind the
 * sign-in still follows their system preference.
 *
 * Surfaces are built as nested shells rather than flat rectangles: an outer
 * tray holding an inner plate with its own top highlight. Flat panels on a
 * flat ground is the thing that made this page read as a template.
 */
export default function Landing() {
  const install = useInstallPrompt();
  useReveal([install]);

  return (
    <div className="landing" data-theme="dark">
      {/* Fixed, inert, and above the page: film grain over a flat dark ground
          is what stops it looking like printer toner. */}
      <div className="grain" aria-hidden="true" />

      <header className="landing-bar">
        <div className="wrap landing-bar-inner">
          <span className="landing-brand">
            <img src="/logo-mark.png" alt="" className="brand-mark" />
            Student OS
          </span>
          <Link to="/signin" className="landing-signin">Sign in</Link>
        </div>
      </header>

      <section className="hero">
        {/* Warm light sitting behind the character, so the ground has a source
            rather than being an even field of near-black. */}
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-art" aria-hidden="true">
          <Suspense fallback={null}>
            <OctopusMascot onClick={() => {}} />
          </Suspense>
        </div>

        <div className="wrap hero-copy">
          <span className="eyebrow" data-reveal>For first years</span>
          <h1 data-reveal>Your term, handled.</h1>
          <p className="hero-lead" data-reveal>
            Deadlines, timetable, notes and money in one place. Tell Octi what
            happened and he files it.
          </p>
          <div className="hero-actions" data-reveal>
            <Cta>Start for free</Cta>
            <span className="hero-fine">Free. No card. Works offline.</span>
          </div>
        </div>
      </section>

      {/* Cards overlapping in depth rather than a flat row: the stack is what
          says these are objects, not thumbnails. */}
      <section className="showcase" aria-label="The app">
        <div className="wrap">
          <h2 data-reveal>Four screens, no setup.</h2>
        </div>
        <ul className="screens">
          {SCREENS.map((s, i) => (
            <li key={s.src} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <div className="tray">
                <div className="plate">
                  <img src={s.src} alt={s.alt} loading="lazy" />
                </div>
              </div>
              <span className="screen-label">{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="band">
        <div className="wrap">
          <h2 data-reveal>One sentence does the filing.</h2>
          <div className="say-grid">
            <figure className="say-shot" data-reveal>
              <div className="tray">
                <div className="plate">
                  <img
                    src="/shots/octi-chat-crop.jpg"
                    alt="Octi confirming he added a task and saved a note, with both tools listed"
                    loading="lazy"
                  />
                </div>
              </div>
            </figure>
            <div className="say-text" data-reveal>
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
        <h2 data-reveal>What you get</h2>
        <ul className="does-grid">
          {DOES.map(([name, line], i) => (
            <li key={name} data-reveal style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
              <h3>{name}</h3>
              <p>{line}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" id="get-it">
        <div className="wrap">
          <h2 data-reveal>Put it on your phone</h2>
          <p className="band-lead" data-reveal>
            It installs from the browser. No app store, nothing to update by hand.
          </p>

          <div className="install-grid">
            <div className="install-main tray" data-reveal>
              <div className="plate install-plate">
                <h3>On a laptop</h3>
                <p>
                  Use the install control in the address bar. It then opens in
                  its own window like anything else on your machine.
                </p>
                {install ? (
                  <Cta onClick={install}>Install now</Cta>
                ) : (
                  <Cta to="/signin">Open the app</Cta>
                )}
              </div>
            </div>

            <figure className="install-phone" data-reveal>
              <div className="tray">
                <div className="plate">
                  <img
                    src="/shots/phone-tasks.jpg"
                    alt="The task list on a phone, with chemistry deadlines filed under their subject"
                    loading="lazy"
                  />
                </div>
              </div>
            </figure>

            <div className="install-steps" data-reveal>
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
        <h2 data-reveal>It is free, and it stays yours.</h2>
        <p data-reveal>Your notes and your spending are visible to you and nobody else.</p>
        <div data-reveal>
          <Cta>Start for free</Cta>
        </div>
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
