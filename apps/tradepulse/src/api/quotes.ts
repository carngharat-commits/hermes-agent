/* Client for quotes. Same-origin; the backend picks the source. */

export type Quote = {
  symbol: string;
  price: number;
  day_pct: number | null;
  as_of: string;
  /** "kite" | "http" are real; "stub" is pretend and labelled as such. */
  source: "kite" | "http" | "stub" | string;
};

export type QuoteBatch = {
  source: string;
  live: boolean;
  as_of: string;
  quotes: Record<string, Quote>;
};

export type QuoteStatus = {
  source: string;
  live: boolean;
  http_configured: boolean;
  kite_promoted: boolean;
};

async function json<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const getQuotes = (symbols: string[]) =>
  json<QuoteBatch>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);

export const getQuoteStatus = () => json<QuoteStatus>("/api/quotes/status");
