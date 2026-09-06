/* Client for the app's own login. Same-origin like everything else: the
   HttpOnly auth cookie rides on every /api request automatically. */

export type AuthUser = { username: string; name: string; role: "owner" | "member" | string };

export type AuthSession =
  | { authenticated: true; required: boolean; setup_required: false; user: AuthUser }
  | { authenticated: false; required: true; setup_required: boolean };

export type Credentials = { username: string; password: string };
export type NewAccount = Credentials & { name: string; role?: "owner" | "member" };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `${path} failed (HTTP ${res.status})`);
    (error as any).status = res.status;
    (error as any).type = body.error_type;
    throw error;
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) =>
  json<T>(path, { method: "POST", body: JSON.stringify(body) });

export const getAuthSession = () => json<AuthSession>("/api/auth/session");
export const setupFirstAccount = (account: NewAccount) => post<AuthSession>("/api/auth/setup", account);
export const login = (credentials: Credentials) => post<AuthSession>("/api/auth/login", credentials);
export const logout = () => post<{ authenticated: false }>("/api/auth/logout", {});
export const changePassword = (current: string, next: string) =>
  post<{ ok: true }>("/api/auth/password", { current, new: next });
export const listUsers = () => json<{ users: (AuthUser & { id: number })[] }>("/api/auth/users");
export const addUser = (account: NewAccount) => post<{ user: AuthUser & { id: number } }>("/api/auth/users", account);
