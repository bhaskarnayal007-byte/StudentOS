import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../lib/useReveal.js";
import LogoWheel from "./LogoWheel";

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
    said: "Map out organic chem: alkanes, alkenes and alcohols",
    did: ["add_topics"],
  },
  {
    said: "Gym every Monday 7 to 9, and wake me at 6:30 tomorrow",
    did: ["add_schedule_block", "set_alarm"],
  },
];

/** How it helps, in the four jobs a term actually throws at a student. */
const HELPS: { icon: string; title: string; body: string; bits: string[] }[] = [
  {
    icon: "◷",
    title: "Never miss a deadline",
    body: "Every due date, class and exam in one timeline, sorted so the next thing is always on top.",
    bits: ["Tasks & priorities", "Calendar", "Weekly timetable"],
  },
  {
    icon: "✣",
    title: "See the whole subject",
    body: "Map each course as a tree of topics and sub-topics, and tick them off as you learn them.",
    bits: ["Mind maps", "Progress per subject"],
  },
  {
    icon: "❏",
    title: "Keep every note together",
    body: "Notes filed by subject, with the lecture slides, PDFs and photos open right beside them.",
    bits: ["PDF & slides", "Photos & docs"],
  },
  {
    icon: "◉",
    title: "Focus, then switch off",
    body: "A study timer that logs your week, a spending tracker, and it all keeps working offline.",
    bits: ["Focus timer", "Spending", "Offline"],
  },
];

/** "Student OS", one span per letter so the intro can raise them in turn. */
function Wordmark() {
  const word = (text: string, from: number, className?: string) =>
    [...text].map((ch, i) => (
      <span key={from + i} className={className} style={{ "--i": from + i } as React.CSSProperties}>
        {ch}
      </span>
    ));
  return (
    <h1 className="intro-word" aria-label="Student OS">
      <span aria-hidden="true">
        {word("Student", 0)}
        <span className="intro-space"> </span>
        {word("OS", 8, "intro-os")}
      </span>
    </h1>
  );
}

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

      {/* The mark, huge and barely there, turning behind the whole page. */}
      <LogoWheel size="100%" className="landing-watermark" />

      <header className="landing-bar">
        <div className="wrap landing-bar-inner">
          <a href="#top" className="landing-brand" aria-label="Student OS, back to top">
            {/* Turns with the scroll, like a wheel being steered. */}
            <LogoWheel size={34} className="brand-wheel" />
            Student OS
          </a>
          <nav className="landing-nav">
            {/* Always present, whether or not the browser offers its own
                install prompt: the page is how people get the app, so there
                has to be something to press that says so. */}
            <a href="#get-it" className="landing-get">Get the app</a>
            <Link to="/signin" className="landing-signin">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* The opening: the wheel builds itself and spins to a stop, Octi bobs
          up beside it, then the name and the promise. Everything after this
          is the explanation. */}
      <section className="intro" id="top">
        <div className="intro-glow" aria-hidden="true" />

        <div className="intro-lockup">
          <div className="intro-wheel">
            <LogoWheel size="100%" intro title="Student OS logo" />
          </div>
          <div className="intro-octi" aria-hidden="true">
            <Suspense fallback={<img src="/mascot.png" alt="" className="intro-octi-still" />}>
              <OctopusMascot onClick={() => {}} />
            </Suspense>
          </div>
        </div>

        <Wordmark />
        <p className="intro-lead">
          Steer your whole term from one place. <span>Octi does the paperwork.</span>
        </p>
        <div className="intro-actions">
          <Cta>Start for free</Cta>
          <a href="#helps" className="intro-more">See how it helps ↓</a>
        </div>
        <span className="intro-fine">Free. No card. Works offline.</span>
      </section>

      <section className="helps" id="helps">
        <div className="wrap">
          <span className="eyebrow" data-reveal>Built for first years</span>
          <h2 data-reveal>How Student OS helps</h2>
          <p className="helps-lead" data-reveal>
            Everything a term throws at you, in one place that keeps itself tidy.
          </p>

          <ul className="helps-grid">
            {HELPS.map(({ icon, title, body, bits }, i) => (
              <li key={title} className="help-card" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="help-icon" aria-hidden="true">{icon}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <ul className="help-bits">
                  {bits.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The product, as a conversation: what you say, and what Octi does
          with it, using the real tool names. */}
      <section className="says band">
        <div className="wrap says-inner">
          <div className="says-copy">
            <img src="/mascot.png" alt="" className="says-octi" data-reveal />
            <h2 data-reveal>Or just tell Octi.</h2>
            <p className="says-lead" data-reveal>
              Say it the way you would to a friend. Octi reads the date, the
              subject and the amount out of the sentence, then does every part
              of it.
            </p>
            <p className="says-foot" data-reveal>
              He shows you everything he touched, every time, and asks before
              deleting anything.
            </p>
          </div>

          <ol className="chat-demo">
            {SENTENCES.map(({ said, did }, i) => (
              <li key={said} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <p className="demo-you">{said}</p>
                <div className="demo-octi">
                  <img src="/mascot.png" alt="" />
                  <ul>
                    {did.map((tool) => (
                      <li key={tool}><code>{tool}</code></li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
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
        <div className="closer-wheel" data-reveal>
          <LogoWheel size="100%" title="Student OS logo" />
        </div>
        <h2 data-reveal>Your term, handled.</h2>
        <p data-reveal>
          It is free, and it stays yours. Your notes and your spending are
          visible to you and nobody else.
        </p>
        <div data-reveal>
          <Cta>Start for free</Cta>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="wrap landing-foot-inner">
          <span className="landing-foot-brand">
            <LogoWheel size={22} />
            © 2026 Student OS · Created by Bhaskar Nayal
          </span>
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
