// The signed-out landing page at /: what Stratus is, opening with the wheel-and-Octi intro.
import { Suspense, lazy, useEffect } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../lib/useReveal.js";
import { syncThemeColor } from "../lib/themeColor.js";
import LogoWheel from "./LogoWheel";
import StratusWordmark from "./StratusWordmark";
import { isNative } from "../lib/supabase.js";

// Same reasoning as HomePage: three.js is the heaviest thing we ship, and a
// stranger deciding whether to sign up shouldn't wait for it to paint.
// Not precached (vite.config.js): offline on a first visit the import fails,
// so keep the still image instead of crashing the page.
const OctopusMascot = lazy(() =>
  import("./mascot/OctopusMascot").catch(() => ({
    default: () => <img src="/mascot.png" alt="" className="intro-octi-still" />,
  })),
);

/**
 * What one sentence turns into. Each result maps to a real tool in
 * src/ai/tools.js (add_expense, start_timer, add_task, add_note, add_topics,
 * add_schedule_block, set_alarm), written the way the app reports it back.
 */
const SENTENCES: { said: string; did: string[] }[] = [
  {
    said: "Spent 180 on lunch. Start a 25 minute study timer.",
    did: ["Expense logged · 180 · Food", "Focus timer · 25:00"],
  },
  {
    said: "Chem lab report due Friday, and the exam is on the 15th.",
    did: ["Task · Lab report · Fri", "Note · Chem exam · 15th"],
  },
  {
    said: "Map out organic chem: alkanes, alkenes and alcohols.",
    did: ["Mind map · 3 topics added"],
  },
  {
    said: "Gym every Monday 7 to 9, and wake me at 6:30 tomorrow.",
    did: ["Timetable · Mon 7–9", "Alarm · 6:30"],
  },
];

/** The four jobs a term actually throws at a student. */
const HELPS: { icon: string; title: string; body: string; bits: string[] }[] = [
  {
    icon: "◷",
    title: "Nothing sneaks up on you",
    body: "Every deadline, class and exam on one timeline, with whatever is next always sitting on top.",
    bits: ["Tasks", "Calendar", "Timetable"],
  },
  {
    icon: "✣",
    title: "See the whole subject",
    body: "Each course becomes a map of topics. Tick them off as you learn and watch the gaps close before the exam.",
    bits: ["Mind maps", "Progress"],
  },
  {
    icon: "❏",
    title: "Notes next to their sources",
    body: "Notes filed by subject, with the lecture slides, PDFs and photos open right beside them.",
    bits: ["PDFs & slides", "Photos"],
  },
  {
    icon: "◉",
    title: "Focus, then switch off",
    body: "A focus timer that logs your week, and a spending tracker that keeps you honest.",
    bits: ["Focus timer", "Spending"],
  },
];

/** Friends and sharing: what lib/social.js, shareCopy.js and the chats page do. */
const TOGETHER: { icon: string; title: string; body: string }[] = [
  {
    icon: "@",
    title: "Find friends by tag",
    body: "Pick your own @tag and add classmates by theirs. Nothing reaches you until you accept.",
  },
  {
    icon: "↗",
    title: "Share in one tap",
    body: "Send a note, an exam date or a whole mind map. It lands as their own copy, ready to edit.",
  },
  {
    icon: "✦",
    title: "Chat, one-to-one or in groups",
    body: "Plan the group project, swap notes and split the work without leaving the app.",
  },
];

/**
 * Slices of the halo above and below the face (which is slice 0). Each slice
 * draws the balls at the width a sphere has at that height, so stacked they
 * read as round; past the thin middle band only the balls and hub remain.
 */
const SLICES = [-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7].map((d) => ({
  d,
  k: Math.sqrt(1 - (d / 8) ** 2),
  cap: Math.abs(d) > 2,
}));

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
 * Black and white only, locked to dark whatever the viewer's theme is. Panels
 * are frosted glass over the turning wheel, so the one moving thing on the
 * page shows through everything that sits on it.
 */
export default function LandingPage() {
  useReveal();

  // Phone bars go black here, and back to the theme once signed in.
  useEffect(() => {
    syncThemeColor();
    return () => { requestAnimationFrame(syncThemeColor); };
  }, []);

  return (
    // In the Android app this is the welcome screen: the intro alone, one
    // screen tall, no top bar and no sales pitch. Someone who installed the
    // app has already been sold; they want to sign in.
    <div className={`landing${isNative ? " landing-app" : ""}`} data-theme="dark">
      {/* Fixed, inert, and above the page: grain keeps flat black from
          looking like a dead screen. */}
      <div className="grain" aria-hidden="true" />

      {/* The mark, huge and faint, turning behind the whole page. */}
      <LogoWheel size="100%" className="landing-watermark" />

      {!isNative && <header className="landing-bar">
        <div className="landing-bar-inner glass">
          <a href="#top" className="landing-brand" aria-label="Stratus, back to top">
            {/* Turns with the scroll, like a wheel being steered. */}
            <LogoWheel size={26} className="brand-wheel" />
            <StratusWordmark className="brand-word" />
          </a>
          <nav className="landing-nav">
            <Link to="/signup" className="landing-get">Get started</Link>
            <Link to="/signin" className="landing-signin">Sign in</Link>
          </nav>
        </div>
      </header>}

      {/* The opening: the wheel builds itself alone and spins to a stop, then
          lifts to hover over Octi's head as he rises in, then the name draws
          itself and the promise follows. */}
      <section className="intro" id="top">
        <div className="intro-glow" aria-hidden="true" />

        <div className="intro-lockup">
          <div className="intro-wheel">
            {/* Slices stacked through the face give the halo real depth once
                it tilts. Flat SVG layers in CSS 3D; no WebGL needed. */}
            {SLICES.map(({ d, k, cap }) => (
              <LogoWheel
                key={d}
                size="100%"
                className={`wheel-edge${cap ? " wheel-cap" : ""}`}
                style={{ "--d": d, "--k": k } as React.CSSProperties}
              />
            ))}
            <LogoWheel size="100%" intro title="Stratus logo" />
          </div>
          <div className="intro-octi" aria-hidden="true">
            <Suspense fallback={<img src="/mascot.png" alt="" className="intro-octi-still" />}>
              <OctopusMascot onClick={() => {}} />
            </Suspense>
          </div>
        </div>

        <h1 className="intro-word">
          <StratusWordmark title="Stratus" />
        </h1>
        <p className="intro-lead">
          Say what's coming up. <span>Octi turns it into a plan.</span>
        </p>
        <p className="intro-sub">
          Deadlines, classes, notes and money, all in one calm place that keeps itself tidy.
        </p>
        <div className="intro-actions">
          <Cta>Get started</Cta>
          {isNative ? (
            <Link to="/signin" className="intro-more glass">I have an account</Link>
          ) : (
            <a href="#problem" className="intro-more glass">See how it works ↓</a>
          )}
        </div>
      </section>

      {!isNative && (<>
      {/* The pain first: a visitor has to recognise their own week before a
          feature list means anything. */}
      <section className="wrap problem" id="problem">
        <span className="eyebrow" data-reveal>The problem</span>
        <h2 data-reveal>
          Five apps, three group chats, <em>and the deadline you forgot.</em>
        </h2>
        <p className="section-lead" data-reveal>
          Your term is spread across a calendar, a notes app, a to-do list, a
          spending spreadsheet and your own memory. Stratus pulls all of it into
          one place, and Octi keeps it in order so you don't have to.
        </p>
      </section>

      {/* The product, as a conversation: what you say, and what Octi does. */}
      <section className="says">
        <div className="wrap says-inner">
          <div className="says-copy">
            <span className="eyebrow" data-reveal>Meet Octi</span>
            <h2 data-reveal>Just say it. <em>Octi handles the rest.</em></h2>
            <p className="section-lead" data-reveal>
              No forms and no menus. Type it the way you'd text a friend, and
              Octi pulls the date, the subject and the amount out of the
              sentence, then files every part of it.
            </p>
            <p className="says-foot" data-reveal>
              He shows you everything he changed, every time, and always asks
              before deleting anything.
            </p>
          </div>

          <ol className="chat-demo glass" data-reveal>
            {SENTENCES.map(({ said, did }) => (
              <li key={said}>
                <p className="demo-you">{said}</p>
                <div className="demo-octi">
                  <img src="/mascot.png" alt="" />
                  <ul>
                    {did.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap helps" id="helps">
        <span className="eyebrow" data-reveal>Everything in one place</span>
        <h2 data-reveal>Built for the way a term <em>actually goes.</em></h2>

        <ul className="helps-grid">
          {HELPS.map(({ icon, title, body, bits }, i) => (
            <li key={title} className="help-card glass" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="help-icon" aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
              <ul className="help-bits">
                {bits.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap together" id="together">
        <span className="eyebrow" data-reveal>Better together</span>
        <h2 data-reveal>Study with your friends, <em>not just next to them.</em></h2>
        <p className="section-lead" data-reveal>
          Your group chat already has the exam date, the shared notes and the
          plan. Now it sits right next to your calendar and your mind maps.
        </p>

        <ul className="together-grid">
          {TOGETHER.map(({ icon, title, body }, i) => (
            <li key={title} className="help-card glass" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="help-icon" aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <p className="together-foot" data-reveal>
          Only friends you accept can message you or send you anything. Your
          notes and spending stay visible to you and nobody else.
        </p>
      </section>

      <section className="wrap closer">
        <div className="closer-card glass" data-reveal>
          <div className="closer-wheel">
            <LogoWheel size="100%" title="Stratus logo" />
          </div>
          <h2>Take the wheel <em>of your term.</em></h2>
          <p>
            Set it up in a minute. Tell Octi what's coming, and walk into every
            deadline already ready for it.
          </p>
          <Cta>Get started</Cta>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="wrap landing-foot-inner">
          <span className="landing-foot-brand">
            <LogoWheel size={20} />
            © 2026 Stratus · Created by Bhaskar Nayal
          </span>
          <span className="landing-foot-links">
            <Link to="/signup">Create an account</Link>
            <Link to="/signin">Sign in</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </span>
        </div>
      </footer>
      </>)}
    </div>
  );
}
