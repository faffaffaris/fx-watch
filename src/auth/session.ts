export type Role = "admin" | "analyst";

export type Session = {
  username: string;
  role: Role;
};

const STORAGE_KEY = "fx-watch-session";

const ACCOUNTS: { username: string; password: string; role: Role }[] = [
  { username: "admin", password: "fxwatch-admin", role: "admin" },
  { username: "analyst", password: "fxwatch", role: "analyst" },
];

export function signIn(username: string, password: string): Session | null {
  const account = ACCOUNTS.find((item) => item.username === username.trim() && item.password === password);
  if (!account) return null;
  const session: Session = { username: account.username, role: account.role };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function readSession(): Session | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if ((parsed.role === "admin" || parsed.role === "analyst") && typeof parsed.username === "string") return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function signOut(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
