import { useEffect, useMemo, useState } from "react";

import { getQuotes, type Quote } from "@/api/quotes";

export type QuotesState = {
  bySymbol: Record<string, Quote>;
  /** Where this batch came from; "stub" means pretend prices. */
  source: string;
  live: boolean;
  loading: boolean;
};

const EMPTY: QuotesState = { bySymbol: {}, source: "none", live: false, loading: false };

/**
 * Latest quotes for a set of symbols, refreshed on an interval.
 *
 * Batched per table like `useIntel`, and additive in the same way: when the
 * backend is unreachable this returns an empty map and every caller renders
 * what it rendered before.
 *
 * The rule for using what comes back lives with the callers, but it is one
 * rule: a **stub** quote may fill a price nobody supplied; it may never
 * overwrite one somebody did. A live quote (kite, http) overrides.
 */
export function useQuotes(symbols: string[], everyMs = 30_000): QuotesState {
  const [state, setState] = useState<QuotesState>(EMPTY);
  const key = useMemo(
    () => [...new Set(symbols.filter(Boolean).map((s) => s.toUpperCase()))].sort().join(","),
    [symbols],
  );

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const batch = await getQuotes(key.split(","));
        if (cancelled) return;
        setState({ bySymbol: batch.quotes, source: batch.source, live: batch.live, loading: false });
      } catch {
        if (!cancelled) setState({ ...EMPTY });
      }
      if (!cancelled) timer = setTimeout(tick, everyMs);
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [key, everyMs]);

  return key ? state : EMPTY;
}

/** Apply the one rule to a row that carries `ltp` and `dayPct`. */
export function withQuote<T extends { sym?: string; ltp?: number; dayPct?: number }>(
  row: T, quote: Quote | undefined,
): T & { quoteSource?: string } {
  if (!quote) return row;
  const existing = Number(row.ltp) > 0;
  if (quote.source === "stub" && existing) return row;          // never overwrite
  return {
    ...row,
    ltp: quote.price,
    dayPct: quote.day_pct ?? row.dayPct,
    quoteSource: quote.source,
  };
}
