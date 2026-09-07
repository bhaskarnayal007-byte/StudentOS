import { useEffect, useRef, useState } from "react";
import type { SeedRect } from "../PortalTransition";
import { createCredential } from "./password";

const MIN_LENGTH = 6;

type Props = {
  /** Any name already stored — an existing user adding a password shouldn't
   *  have to retype who they are. */
  initialName?: string;
  onSubmit: (
    result: { name: string; salt: string; hash: string },
    seeds: SeedRect[],
  ) => void;
};

/** First run: choose a display name and set the password that will unlock the
 *  app on later visits. */
export default function NameEntryForm({ initialName = "", onSubmit }: Props) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cardRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return setError("Enter a name to continue.");
    if (password.length < MIN_LENGTH) {
      return setError(`Password needs at least ${MIN_LENGTH} characters.`);
    }
    if (password !== confirm) return setError("The two passwords don't match.");

    // Measure while the form is still on screen — once it unmounts the rects
    // are all zero and the particles have nothing to sample.
    const seeds = collectSeeds(cardRef.current);

    setBusy(true);
    setError("");
    try {
      // Deliberately slow by design (150k PBKDF2 rounds), hence the busy state.
      const credential = await createCredential(password);
      onSubmit({ name: trimmed, ...credential }, seeds);
    } catch {
      setBusy(false);
      setError("Couldn't set the password on this browser.");
    }
  }

  return (
    <form className="login-card" ref={cardRef} onSubmit={submit}>
      <img src="/logo-mark.png" alt="" className="login-mark" data-seed />

      <h1 data-seed>Student OS</h1>
      <p className="login-sub" data-seed>
        Set up your space. Takes a moment.
      </p>

      <label className="field">
        <span>What should we call you?</span>
        <input
          ref={firstRef}
          className="grow"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="Your name"
          autoComplete="given-name"
          maxLength={40}
          data-seed
        />
      </label>

      <label className="field">
        <span>Choose a password</span>
        <input
          className="grow"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder={`At least ${MIN_LENGTH} characters`}
          autoComplete="new-password"
          data-seed
        />
      </label>

      <label className="field">
        <span>Confirm password</span>
        <input
          className="grow"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          placeholder="Type it again"
          autoComplete="new-password"
          data-seed
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="primary login-go" disabled={busy} data-seed>
        {busy ? "Setting up…" : "Enter"}
      </button>

      <p className="login-note">
        Stored only on this device. There is no recovery if you forget it.
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
