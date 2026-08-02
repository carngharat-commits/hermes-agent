/* Client for the Kite OAuth backend in server/.
   Everything is same-origin: Vite proxies /api to the FastAPI process, so the
   HttpOnly session cookie set by the callback is sent automatically. */

export type KiteMode = "live" | "stub";

export type KiteStatus = {
  configured: boolean;
  mode: KiteMode;
  redirect_url: string;
};

export type KiteProfile = {
  user_id: string;
  user_name: string;
  email: string;
  broker: string;
  login_time: string;
  exchanges: string[];
};

export type KiteSession =
  | { authenticated: false; mode: KiteMode }
  | { authenticated: true; mode: KiteMode; profile: KiteProfile };

const LOGIN_PATH = "/api/kite/login";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const getKiteStatus = () => json<KiteStatus>("/api/kite/status");

export const getKiteSession = () => json<KiteSession>("/api/kite/session");

export const logoutKite = () =>
  json<{ authenticated: false }>("/api/kite/logout", { method: "POST" });

/** Full-page navigation — the OAuth handshake has to own the browser. */
export const startKiteLogin = () => {
  window.location.href = LOGIN_PATH;
};

/** Reads the `?kite=…` / `?kite_error=…` the callback bounces back with. */
export const readKiteRedirectResult = (): { connected: boolean; error: string | null } => {
  const params = new URLSearchParams(window.location.search);
  return {
    connected: params.get("kite") === "connected",
    error: params.get("kite_error"),
  };
};

/** Drops those params so a refresh doesn't replay the banner. */
export const clearKiteRedirectResult = () => {
  const url = new URL(window.location.href);
  ["kite", "kite_error", "kite_detail"].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.toString());
};
