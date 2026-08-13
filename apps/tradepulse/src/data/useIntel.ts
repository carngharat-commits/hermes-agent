import { useEffect, useMemo, useState } from "react";

import { enrich, type EnrichedRow } from "@/api/intel";

export type IntelState = {
  /** Keyed by symbol; missing means uncovered or the layer is unreachable. */
  bySymbol: Record<string, EnrichedRow>;
  loading: boolean;
  error: string | null;
};

/**
 * Valuation and current AI call for a table of symbols.
 *
 * Batched deliberately: a watchlist or a segment drill renders dozens of rows,
 * and a per-row fetch would be dozens of requests on every render. The backend
 * answers the whole table in one call.
 *
 * The intelligence layer is additive — when it is unreachable this returns an
 * empty map and every caller renders exactly what it rendered before.
 */
export function useIntel(rows: { sym: string; ltp?: number }[]): IntelState {
  const [bySymbol, setBySymbol] = useState<Record<string, EnrichedRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only re-fetch when the symbol set changes, not on every price tick.
  const symbols = useMemo(
    () => [...new Set(rows.map((r) => r.sym).filter(Boolean))].sort(),
    [rows],
  );
  const key = symbols.join(",");

  useEffect(() => {
    // Nothing to look up. No state change needed — the empty result is
    // derived below, so this stays out of the effect entirely.
    if (!key) return;

    let cancelled = false;

    // Wrapped so the state updates hang off the request rather than running
    // synchronously in the effect body.
    (async () => {
      setLoading(true);
      const payload = symbols.map((sym) => ({
        sym,
        // One price per symbol — the first row's. A table normally has one
        // row per ticker, but a watchlist can hold the same name twice; the
        // caller decides which rows are eligible before passing them in.
        ltp: Number(rows.find((r) => r.sym === sym)?.ltp ?? 0),
      }));
      try {
        const response = await enrich(payload);
        if (cancelled) return;
        const next: Record<string, EnrichedRow> = {};
        for (const row of response.rows) next[row.sym] = row;
        setBySymbol(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setBySymbol({});
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `rows` is rebuilt on every render by callers; `key` is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // An empty symbol set has an empty answer, regardless of what a previous
  // render fetched.
  return { bySymbol: key ? bySymbol : {}, loading, error };
}
