import { useMemo } from "react";

import { GTT_ORDERS, ORDERS } from "@/data/trading";
import { getKiteOrders, type KiteOrderBook } from "@/api/kite";
import { KITE_BROKER, type HoldingsSource } from "@/data/usePortfolio";
import { useKiteResource } from "@/data/useKiteResource";

export type OrdersState = {
  orders: any[];
  gtts: any[];
  /** Where the Zerodha rows came from. Other brokers stay on the snapshot. */
  source: HoldingsSource;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const describeGaps = (book: KiteOrderBook) =>
  book.unavailable.includes("gtt")
    ? "Kite returned no GTT triggers — this app's Kite key may not have the GTT scope."
    : null;

/**
 * Order book and GTT triggers, on the same merge rule as holdings: a live sync
 * replaces the Zerodha rows and leaves every other broker's on the snapshot.
 */
export function useOrders(): OrdersState {
  const { data, loading, error, refresh } = useKiteResource(getKiteOrders, describeGaps);

  const orders = useMemo(() => {
    if (!data) return ORDERS;
    return [...data.orders, ...ORDERS.filter((o: any) => o.broker !== KITE_BROKER)];
  }, [data]);

  const gtts = useMemo(() => {
    if (!data) return GTT_ORDERS;
    return [...data.gtts, ...GTT_ORDERS.filter((g: any) => g.broker !== KITE_BROKER)];
  }, [data]);

  return {
    orders,
    gtts,
    source: data ? data.mode : "snapshot",
    loading,
    error,
    refresh,
  };
}
