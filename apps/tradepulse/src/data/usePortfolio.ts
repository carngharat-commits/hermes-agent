import { useCallback, useMemo } from "react";

import { addToBook, flattenBook, useBook, type BookSource } from "@/data/book";
import { getKitePortfolio, type KitePortfolio } from "@/api/kite";
import { useKiteResource } from "@/data/useKiteResource";

/** Broker label the book uses for rows Kite would also report. */
export const KITE_BROKER = "Zerodha";

export type HoldingsSource = "snapshot" | "live" | "stub" | "empty" | "demo" | "manual" | "mixed";

export type PortfolioState = {
  holdings: any[];
  /** Where the Zerodha rows came from. The rest is always the snapshot. */
  source: HoldingsSource;
  portfolio: KitePortfolio | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addHolding: (holding: any) => void;
};

const describeGaps = (p: KitePortfolio) =>
  p.unavailable.length
    ? `Kite returned no ${p.unavailable.join(" or ")} — holdings are still current.`
    : null;

/**
 * Holdings for the whole app.
 *
 * The book starts empty and lives in `data/book.ts` — demo rows, manual adds
 * and nothing else until a broker is connected. Kite knows one broker, so a
 * live sync replaces exactly the Zerodha slice of the book; every other
 * broker's rows stay as they were, because nothing has been connected that
 * could speak for them.
 */
export function usePortfolio(): PortfolioState {
  const { data: portfolio, loading, error, refresh } = useKiteResource(
    getKitePortfolio,
    describeGaps,
  );
  const book = useBook();

  const holdings = useMemo(() => {
    const own = flattenBook(book);
    if (!portfolio) return own;
    const others = own.filter((h: any) => h.broker !== KITE_BROKER);
    return [...portfolio.holdings, ...others];
  }, [portfolio, book]);

  const addHolding = useCallback((holding: any) => addToBook(holding), []);

  const source: HoldingsSource = portfolio ? portfolio.mode : (book.source as BookSource);

  return {
    holdings,
    source,
    portfolio,
    loading,
    error,
    refresh,
    addHolding,
  };
}
