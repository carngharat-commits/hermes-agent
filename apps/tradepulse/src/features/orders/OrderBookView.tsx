/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { ORDERS } from "@/data/trading";
import { OrderRow } from "@/features/orders/OrderRow";

export const OrderBookView = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const filtered = useMemo(() => {
    return ORDERS.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (typeFilter   !== "all" && o.type   !== typeFilter) return false;
      return true;
    });
  }, [statusFilter, typeFilter]);
  return (
    <>
      <Card padded={false} className="p-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all",      l:"All" },
            { k:"EXECUTED", l:"Executed" },
            { k:"PENDING",  l:"Pending" },
            { k:"REJECTED", l:"Rejected" },
          ].map(o => (
            <button key={o.k} onClick={() => setStatusFilter(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: statusFilter === o.k ? T.fg : "transparent",
                color: statusFilter === o.k ? T.bg : T.fgMute,
                border: `1px solid ${statusFilter === o.k ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all", l:"Any type" },
            { k:"CNC", l:"CNC · Delivery" },
            { k:"MIS", l:"MIS · Intraday" },
            { k:"GTT", l:"GTT" },
          ].map(o => (
            <button key={o.k} onClick={() => setTypeFilter(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: typeFilter === o.k ? T.card2 : "transparent",
                color: typeFilter === o.k ? T.fg : T.fgMute,
                border: `1px solid ${typeFilter === o.k ? T.primary : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><div className="py-6 text-center text-[13px]" style={{ color: T.fgMute }}>No orders match your filters</div></Card>
      ) : (
        <Card padded={false}>
          {filtered.map(o => <OrderRow key={o.id} o={o} />)}
        </Card>
      )}
    </>
  );
};
