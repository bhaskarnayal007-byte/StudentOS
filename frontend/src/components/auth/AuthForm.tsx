import { useEffect, useRef, useState } from "react";
import type { SeedRect } from "../PortalTransition";
import { supabase } from "../../lib/supabase.js";
import { signInWithGoogle } from "../../auth/useSession.js";

const MIN_LENGTH = 6;

type Props = {
  /** Called once a session exists. The seeds are measured from this card so
   *  the portal particles can fly out of the real form. */
  onAuthed: (seeds: SeedRect[]) => void;
  /** Which side of the form to open on. Someone arriving from "Start for free"
   *  is not coming back to anything, and used to land on a sign-in form and
   *  have to find the create-account link. */
  initialMode?: "signin" | "signup";
};

/**
 * Sign in / sign up against Supabase Auth.
 *
 * One component for both, because the two differ by a single field and a
 * single API call — two files would duplicate the whole layout to save an
 * `if`.
 */
export default function AuthForm({ onAuthed, initialMode = "signin" }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const cardRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [mode]);

  function fail(message: string) {
    setError(message);
    // Bumping a counter rather than toggling a class: restarting a CSS
    // animation needs the element's key to actually change.
    setShake((n) => n + 1);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!email.trim()) return fail("Enter your email.");
    if (password.length < MIN_LENGTH) {
      return fail(`Password needs at least ${MIN_LENGTH} characters.`);
    }
    if (mode === "signup" && !name.trim()) return fail("Enter a name to continue.");

    // Measured while the card is still on screen — once it unmounts every rect
    // is zero and the particles have nothing to sample.
    const seeds = collectSeeds(cardRef.current);

    setBusy(true);
    setError("");
    setNotice("");

    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Rides along on the user record, so the greeting survives a new
        // device without needing a profiles table.
        options: { data: { name: name.trim().replace(/\s+/g, " ") } },
      });

      if (err) return fail(err.message);

      // With email confirmation on, signUp succeeds but returns no session —
      // the account exists and is waiting on a click in an inbox.
      if (!data.session) {
        setBusy(false);
        setNotice("Check your email for a confirmation link, then sign in.");
        setMode("signin");
        return;
      }

      onAuthed(seeds);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      setPassword("");
      return fail(err.message);
    }

    onAuthed(seeds);
  }

  const signup = mode === "signup";

  return (
    <form
      key={shake}
      className={shake ? "login-card login-shake" : "login-card"}
      ref={cardRef}
      onSubmit={submit}
    >
      <img src="/logo-mark.png" alt="" className="login-mark" data-seed />

      <h1 data-seed>{signup ? "Student OS" : "Welcome back"}</h1>
      <p className="login-sub" data-seed>
        {signup ? "Set up your space. Takes a moment." : "Sign in to continue."}
      </p>

      {signup && (
        <label className="field">
          <span>What should we call you?</span>
          <input
            ref={signup ? firstRef : undefined}
            className="grow"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="Your name"
            autoComplete="given-name"
            maxLength={40}
            data-seed
          />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          ref={signup ? undefined : firstRef}
          className="grow"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          autoComplete="email"
          data-seed
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          className="grow"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder={signup ? `At least ${MIN_LENGTH} characters` : "Your password"}
          autoComplete={signup ? "new-password" : "current-password"}
          data-seed
        />
      </label>

      {error && <p className="error">{error}</p>}
      {notice && <p className="login-note">{notice}</p>}

      <button className="primary login-go" disabled={busy} data-seed>
        {busy ? (signup ? "Setting up…" : "Signing in…") : signup ? "Create account" : "Sign in"}
      </button>

      {/* Google leaves the page and returns with a session, so there is no
          success branch here — only a failure to report. */}
      <button
        type="button"
        className="oauth-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const { error: err } = await signInWithGoogle();
          if (err) fail(err.message);
        }}
      >
        <img src="/google.svg" alt="" width={18} height={18} />
        Continue with Google
      </button>

      <button
        type="button"
        className="ghost always"
        onClick={() => {
          setMode(signup ? "signin" : "signup");
          setError("");
          setNotice("");
        }}
      >
        {signup ? "I already have an account" : "Create an account"}
      </button>

      <p className="login-note">
        Your account is stored with Supabase. Your data syncs to every device
        you sign in on.
      </p>
    </form>
  );
}

export function collectSeeds(root: HTMLElement | null): SeedRect[] {
  return [...(root?.querySelectorAll("[data-seed]") ?? [])].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
