import NameEntryForm from "./NameEntryForm";
import UnlockForm from "./UnlockForm";
import type { SeedRect } from "../PortalTransition";
import type { Credential } from "./password";

type Props = {
  /** "setup" on first run (or for an existing user who has no password yet),
   *  "unlock" on every later visit. */
  mode: "setup" | "unlock";
  name: string;
  credential: Credential;
  onSetup: (result: { name: string; salt: string; hash: string }, seeds: SeedRect[]) => void;
  onUnlock: (seeds: SeedRect[]) => void;
};

/**
 * The animated background is NOT rendered here — AppBackground is mounted once
 * at the root and stays put across the gate, the transition and the app, so
 * nothing restarts or flickers when the user crosses over.
 */
export default function LoginPage({ mode, name, credential, onSetup, onUnlock }: Props) {
  return (
    <div className="login-page">
      {mode === "unlock" ? (
        <UnlockForm name={name} credential={credential} onUnlock={onUnlock} />
      ) : (
        <NameEntryForm initialName={name} onSubmit={onSetup} />
      )}
    </div>
  );
}
