import AuthForm from "./AuthForm";
import type { SeedRect } from "../PortalTransition";

type Props = {
  onAuthed: (seeds: SeedRect[]) => void;
  initialMode?: "signin" | "signup";
};

/**
 * The animated background is NOT rendered here — AppBackground is mounted once
 * at the root and stays put across the gate, the transition and the app, so
 * nothing restarts or flickers when the user crosses over.
 */
export default function LoginPage({ onAuthed, initialMode }: Props) {
  return (
    <div className="login-page">
      <AuthForm onAuthed={onAuthed} initialMode={initialMode} />
    </div>
  );
}
