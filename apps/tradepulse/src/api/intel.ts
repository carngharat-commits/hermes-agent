/* Client for the intelligence layer (valuation, recommendations, performance).
   Same-origin like the Kite routes — Vite proxies /api to the backend. */

export type Valuation = {
  id?: number;
  symbol: string;
  as_of: string;
  provider: string;
  intrinsic_value: number | null;
  fair_value: number | null;
  dcf_value: number | null;
  epv_value: number | null;
  market_price: number;
  /** Fraction: 0.28 means trading 28% below intrinsic value. */
  margin_of_safety: number | null;
  /** Signed mirror of the above — negative is a discount. */
  discount_premium: number | null;
  financial_health: number | null;
  business_quality: number | null;
  detail: Record<string, any>;
};

export type Recommendation = {
  id: number;
  symbol: string;
  action: "BUY" | "HOLD" | "REDUCE" | "SELL" | "AVOID";
  created_at: string;
  version: number;
  market_price: number;
  intrinsic_value: number | null;
  confidence: number;
  technical_score: number | null;
  fundamental_score: number | null;
  macro_score: number | null;
  news_sentiment: number | null;
  reasoning: string;
  evidence: Record<string, any>;
};

export type EnrichedRow = {
  sym: string;
  covered: boolean;
  valuation: Valuation | null;
  recommendation: Recommendation | null;
};

export type Coverage = {
  provider: string;
  symbols: string[];
  agents: {
    active: string[];
    pending: { agent: string; needs: string }[];
  };
};

export type Performance = {
  totals: {
    total_recommendations: number;
    judged: number;
    open: number;
    accuracy: number | null;
    win_rate: number | null;
    average_return: number | null;
    average_loss_avoided: number | null;
    wealth_created: number;
    losses_avoided: number;
    capital_protected: number;
    opportunity_cost: number;
    best: { symbol?: string; action?: string; absolute_return: number } | null;
    worst: { symbol?: string; action?: string; absolute_return: number } | null;
  };
  by_action: Record<string, { count: number; accuracy: number; average_return: number }>;
  outcomes: any[];
};

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const getCoverage = () => json<Coverage>("/api/intel/coverage");

export const getPerformance = () => json<Performance>("/api/intel/performance");

/** One request per table rather than one per row. */
export const enrich = (symbols: { sym: string; ltp: number }[]) =>
  json<{ provider: string; rows: EnrichedRow[] }>("/api/intel/enrich", {
    method: "POST",
    body: JSON.stringify({ symbols }),
  });

export const recommend = (symbol: string, price: number, holdings: any[] = []) =>
  json<Recommendation & { agent_views: any[] }>("/api/intel/recommend", {
    method: "POST",
    body: JSON.stringify({ symbol, price, holdings }),
  });

export const getRecommendations = (symbol?: string) =>
  json<{ recommendations: Recommendation[] }>(
    `/api/intel/recommendations${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`,
  );

export const refreshOutcomes = (prices: Record<string, number>) =>
  json<{ scored: number }>("/api/intel/refresh", {
    method: "POST",
    body: JSON.stringify({ prices }),
  });

export const runLearning = () =>
  json<any>("/api/intel/learn", { method: "POST" });
