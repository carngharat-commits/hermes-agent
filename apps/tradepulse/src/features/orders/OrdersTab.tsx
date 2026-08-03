/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Activity, ClipboardList, Info, Plus, Target } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { GTTView } from "@/features/orders/GTTView";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { OrderBookView } from "@/features/orders/OrderBookView";
import { Pill } from "@/components/ui/Pill";
import { PlaceOrderSheet } from "@/features/orders/PlaceOrderSheet";
import { T } from "@/theme/tokens";
import { TradesView } from "@/features/orders/TradesView";
import { useOrders } from "@/data/useOrders";

export const OrdersTab = () => {
  const [tab, setTab] = useState("book"); // book | gtt | trades
  const [placeOpen, setPlaceOpen] = useState(false);
  // Zerodha rows come from Kite once connected; other brokers stay on the
  // bundled snapshot. See data/useOrders.ts.
  const { orders, gtts, source, error } = useOrders();
  const tabs = [
    { k:"book",   l:"Order Book",    ic:ClipboardList, n:orders.length },
    { k:"gtt",    l:"GTT Orders",    ic:Target,        n:gtts.filter(g=>g.status==="ACTIVE").length },
    { k:"trades", l:"Trades",        ic:Activity,      n:orders.filter(o=>o.status==="EXECUTED").length },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <ClipboardList size={20} color={T.primary} /> Orders
            <SourceBadge source={source} />
          </h1>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            Decision-support view — TradePulse doesn't route orders. Execute in your broker app.
          </div>
        </div>
        <Btn onClick={() => setPlaceOpen(true)}><Plus size={14} /> New Order Idea</Btn>
      </div>

      {/* SEBI framing */}
      <div className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30` }}>
        <Info size={13} color={T.info} className="mt-0.5 shrink-0" />
        <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
          <span className="font-semibold">SEBI-compliant framing:</span> Orders shown here are your saved intents + broker mirror.
          Actual order routing happens in your broker app (Kite / ABML / INDmoney). This screen tracks your paper decisions and executed history.
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map(t => {
          const Ic = t.ic;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
              style={{
                background: active ? `${T.primary}18` : T.card2,
                color: active ? T.primary : T.fg,
                border: `1px solid ${active ? `${T.primary}40` : T.border}`,
              }}>
              <Ic size={13} />
              <span className="text-[11.5px] font-semibold">{t.l}</span>
              <Pill tone={active ? "up" : "neutral"} size="xs">{t.n}</Pill>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg text-[11px] leading-relaxed"
          style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30`, color: T.fg }}>
          {error}
        </div>
      )}

      {tab === "book"   && <OrderBookView orders={orders} />}
      {tab === "gtt"    && <GTTView gtts={gtts} />}
      {tab === "trades" && <TradesView orders={orders} />}

      {placeOpen && <PlaceOrderSheet onClose={() => setPlaceOpen(false)} />}
    </div>
  );
};
