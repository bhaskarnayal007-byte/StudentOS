import { useEffect, useRef, useState } from "react";
import type { SeedRect } from "../PortalTransition";
import { collectSeeds } from "./NameEntryForm";
import { verifyPassword, type Credential } from "./password";

type Props = {
  name: string;
  credential: Credential;
  onUnlock: (seeds: SeedRect[]) => void;
};

/** Return visit: the name is already known, so only the password is asked. */
export default function UnlockForm({ name, credential, onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const cardRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) return setError("Enter your password.");

    const seeds = collectSeeds(cardRef.current);

    setBusy(true);
    setError("");
    const ok = await verifyPassword(password, credential);
    setBusy(false);

    if (!ok) {
      setPassword("");
      setError("That password doesn't match.");
      // Bump a counter rather than toggling a class: re-triggering a CSS
      // animation needs the element to actually change key/state.
      setShake((n) => n + 1);
      inputRef.current?.focus();
      return;
    }

    onUnlock(seeds);
  }

  return (
    <form
      key={shake}
      className={shake ? "login-card login-shake" : "login-card"}
      ref={cardRef}
      onSubmit={submit}
    >
      <img src="/logo-mark.png" alt="" className="login-mark" data-seed />

      <h1 data-seed>Welcome back</h1>
      <p className="login-sub" data-seed>
        {name}
      </p>

      <label className="field">
        <span>Password</span>
        <input
          ref={inputRef}
          className="grow"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder="Your password"
          autoComplete="current-password"
          data-seed
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="primary login-go" disabled={busy} data-seed>
        {busy ? "Checking…" : "Unlock"}
      </button>

      <p className="login-note">Locks again when you close this tab.</p>
    </form>
  );
}
