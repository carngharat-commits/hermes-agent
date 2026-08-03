import { useCallback, useMemo, useState } from "react";

import { CRYPTO, DIGITAL_METALS, IN_STOCKS, MUTUAL_FUNDS, US_STOCKS } from "@/data/holdings";
import { getKitePortfolio, type KitePortfolio } from "@/api/kite";
import { useKiteResource } from "@/data/useKiteResource";

/** Broker label the bundled snapshot uses for rows Kite would also report. */
export const KITE_BROKER = "Zerodha";

export const SNAPSHOT = [
  ...IN_STOCKS,
  ...US_STOCKS,
  ...MUTUAL_FUNDS,
  ...CRYPTO,
  ...DIGITAL_METALS,
];

export type HoldingsSource = "snapshot" | "live" | "stub";

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
 * Kite knows one broker, so a live sync replaces exactly the Zerodha slice of
 * the bundled snapshot — ABML, INDmoney, mutual funds, crypto and metals stay
 * as they were, because nothing has been connected that could speak for them.
 * Manually added holdings sit on top of both and survive a refresh.
 */
export function usePortfolio(): PortfolioState {
  const { data: portfolio, loading, error, refresh } = useKiteResource(
    getKitePortfolio,
    describeGaps,
  );
  const [manual, setManual] = useState<any[]>([]);

  const holdings = useMemo(() => {
    if (!portfolio) return [...SNAPSHOT, ...manual];
    const others = SNAPSHOT.filter((h: any) => h.broker !== KITE_BROKER);
    return [...portfolio.holdings, ...others, ...manual];
  }, [portfolio, manual]);

  const addHolding = useCallback(
    (holding: any) => setManual((current) => [...current, holding]),
    [],
  );

  return {
    holdings,
    source: portfolio ? portfolio.mode : "snapshot",
    portfolio,
    loading,
    error,
    refresh,
    addHolding,
  };
}
