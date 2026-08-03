/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Card } from "@/components/ui/Card";
import { KV } from "@/components/ui/KV";
import { OrderRow } from "@/features/orders/OrderRow";
import { USD_INR } from "@/lib/constants";
import { inrCompact } from "@/lib/format";

export const TradesView = ({ orders }: any) => {
  const trades = orders.filter(o => o.status === "EXECUTED");
  const totalBought = trades.filter(t => t.side === "BUY").reduce((s, t) => s + t.qty * t.price * (t.segment === "US" ? USD_INR : 1), 0);
  const totalSold = trades.filter(t => t.side === "SELL").reduce((s, t) => s + t.qty * t.price * (t.segment === "US" ? USD_INR : 1), 0);
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><KV k="Trades" v={trades.length.toString()} /></Card>
        <Card><KV k="Total bought" v={inrCompact(totalBought)} tone="up" /></Card>
        <Card><KV k="Total sold" v={inrCompact(totalSold)} tone="warn" /></Card>
      </div>
      <Card padded={false}>
        {trades.map(t => <OrderRow key={t.id} o={t} />)}
      </Card>
    </>
  );
};
