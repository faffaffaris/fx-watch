import { useState, type FormEvent } from "react";
import { signIn, type Session } from "../auth/session";

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const session = signIn(username, password);
    if (!session) {
      setError("Those credentials are not on this machine.");
      return;
    }
    onLogin(session);
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">Macro spatial</p>
        <h1>FX Watch</h1>
        <p className="muted">Sign in to open the currency-crisis board.</p>
        <label>
          <span>Name</span>
          <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit">Enter</button>
        <details>
          <summary>Local accounts</summary>
          <p className="muted">Admin: admin / fxwatch-admin. Analyst: analyst / fxwatch. This gate lives in the browser on this machine.</p>
        </details>
      </form>
    </main>
  );
}
