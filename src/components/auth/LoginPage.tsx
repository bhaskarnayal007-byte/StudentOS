import AuthForm from "./AuthForm";
import type { SeedRect } from "../PortalTransition";

type Props = {
  onAuthed: (seeds: SeedRect[]) => void;
};

/**
 * The animated background is NOT rendered here — AppBackground is mounted once
 * at the root and stays put across the gate, the transition and the app, so
 * nothing restarts or flickers when the user crosses over.
 */
export default function LoginPage({ onAuthed }: Props) {
  return (
    <div className="login-page">
      <AuthForm onAuthed={onAuthed} />
    </div>
  );
}
