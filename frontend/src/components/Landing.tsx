import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../lib/useReveal.js";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
const OctopusMascot = lazy(() => import("./mascot/OctopusMascot"));

/**
 * What one sentence turns into.
 *
 * The tool names are the real ones from src/ai/tools.js, which is the point:
 * this is a diagram of what actually happens, not a mock of a screen. It also
 * ages correctly, because if the tools are renamed this reads wrong and gets
 * fixed, where a screenshot would just quietly go stale.
 */
const SENTENCES: { said: string; did: string[] }[] = [
  {
    said: "I spent 180 on lunch and start a 25 minute study timer",
    did: ["add_expense", "start_timer"],
  },
  {
    said: "Chem lab report due Friday, and the exam is on the 15th",
    did: ["add_task", "add_note"],
  },
  {
    said: "Gym every Monday 7 to 9, and wake me at 6:30 tomorrow",
    did: ["add_schedule_block", "set_alarm"],
  },
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

/** The pill CTA. The arrow lives in its own well flush to the right inner
 *  padding, and leans out on hover, which makes the press feel mechanical. */
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
    <Link className="cta" to={to ?? "/signup"}>{inner}</Link>
  );
}

/**
 * What a signed-out visitor sees.
 *
 * Locked to dark whatever the viewer's theme is, so the page the world sees is
 * one deliberate thing rather than two half-tuned ones. The app behind the
 * sign-in still follows their system preference.
 *
 * Deliberately has no screenshots. A dark app shot on a dark page is muddy at
 * any size, and shrinking a whole interface into a card shows a visitor
 * nothing they can read. The product is carried by type instead: the sentences
 * people actually say, and what the app does with them.
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
          <nav className="landing-nav">
            {/* Always present, whether or not the browser offers its own
                install prompt: the page is how people get the app, so there
                has to be something to press that says so. */}
            <a href="#get-it" className="landing-get">Get the app</a>
            <Link to="/signin" className="landing-signin">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        {/* Warm light behind the character, so the ground has a source rather
            than being an even field of near-black. */}
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

      {/* The product, as type. Each row is a sentence someone says and the
          things it turns into. */}
      <section className="says">
        <div className="wrap">
          <h2 data-reveal>Say it once.</h2>
          <p className="says-lead" data-reveal>
            Octi reads the date, the subject and the amount out of the sentence,
            then does every part of it.
          </p>

          <ol className="say-list">
            {SENTENCES.map(({ said, did }, i) => (
              <li key={said} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <blockquote>“{said}”</blockquote>
                <div className="say-did">
                  <span className="say-arrow" aria-hidden="true">↳</span>
                  <ul>
                    {did.map((tool) => (
                      <li key={tool}><code>{tool}</code></li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          <p className="says-foot" data-reveal>
            He shows you every one of those, every time. And asks first before
            deleting anything.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap does">
          <h2 data-reveal>What you get</h2>
          <ul className="does-grid">
            {DOES.map(([name, line], i) => (
              <li key={name} data-reveal style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
                <h3>{name}</h3>
                <p>{line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap install" id="get-it">
        <h2 data-reveal>Put it on your phone</h2>
        <p className="install-lead" data-reveal>
          It installs from the browser. No app store, nothing to update by hand.
          {!install && (
            <>
              {" "}
              Chrome and Edge offer a one-click install once you have opened the
              app; on everything else it is the two steps below.
            </>
          )}
        </p>

        <div className="install-grid">
          <div className="tray" data-reveal>
            <div className="plate install-plate">
              <h3>On a laptop</h3>
              <p>
                Use the install control in the address bar. It then opens in its
                own window like anything else on your machine.
              </p>
              {install ? (
                <Cta onClick={install}>Install now</Cta>
              ) : (
                <Cta to="/signup">Create an account</Cta>
              )}
            </div>
          </div>

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
          <span className="landing-foot-links">
            <Link to="/signup">Create an account</Link>
            <Link to="/signin">Sign in</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </span>
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
