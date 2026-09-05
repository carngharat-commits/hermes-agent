/* Client for the app's own login. Same-origin like everything else: the
   HttpOnly auth cookie rides on every /api request automatically. */

export type AuthUser = { name: string };

export type AuthSession =
  | { authenticated: true; required: boolean; user: AuthUser }
  | { authenticated: false; required: true };

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

export const getAuthSession = () => json<AuthSession>("/api/auth/session");

export const login = (passcode: string) =>
  json<AuthSession>("/api/auth/login", { method: "POST", body: JSON.stringify({ passcode }) });

export const logout = () => json<{ authenticated: false }>("/api/auth/logout", { method: "POST" });
