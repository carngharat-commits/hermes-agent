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

/** A holding in the shape `src/data/demoBook.ts` rows use. */
export type KiteHolding = {
  sym: string;
  qty: number;
  avg: number;
  ltp: number;
  dayPct: number;
  broker: string;
  segment: string;
  isin: string;
  pledged: boolean;
  exchange: string;
};

export type KitePosition = {
  sym: string;
  exchange: string;
  product: string;
  qty: number;
  avg: number;
  ltp: number;
  pnl: number;
  dayPct: number;
  broker: string;
};

export type KitePortfolio = {
  mode: KiteMode;
  fetched_at: string;
  broker: string;
  holdings: KiteHolding[];
  positions: KitePosition[];
  margins: Record<string, { enabled: boolean; net: number; live_balance: number; cash: number }>;
  summary: {
    count: number;
    current_value: number;
    invested_value: number;
    pnl: number;
    pnl_pct: number;
  };
  /** Side calls that failed — the response is still usable without them. */
  unavailable: string[];
};

/** An order row in the shape `src/data/trading.ts` uses. */
export type KiteOrder = {
  id: string;
  sym: string;
  side: string;
  type: string;
  qty: number;
  price: number;
  status: string;
  broker: string;
  when: string;
  segment: string;
  reason: string;
  /** Kite's own status, since the UI collapses a dozen states into three. */
  kiteStatus: string;
};

export type KiteGtt = {
  id: string;
  sym: string;
  trigger: number;
  action: string;
  qty: number;
  status: string;
  broker: string;
  created: string;
  note: string;
};

export type KiteOrderBook = {
  mode: KiteMode;
  fetched_at: string;
  broker: string;
  orders: KiteOrder[];
  gtts: KiteGtt[];
  unavailable: string[];
};

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

export const getKitePortfolio = () => json<KitePortfolio>("/api/kite/portfolio");

export const getKiteOrders = () => json<KiteOrderBook>("/api/kite/orders");

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
