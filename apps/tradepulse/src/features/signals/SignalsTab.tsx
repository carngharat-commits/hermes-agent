/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { Info, Target } from "lucide-react";

import { AIChatDrawer } from "@/features/ai/AIChatDrawer";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { SIGNALS } from "@/data/signals";
import { SignalCard } from "@/features/signals/SignalCard";
import { TechnicalChartDrawer } from "@/features/chart/TechnicalChartDrawer";

export const SignalsTab = () => {
  const [filter, setFilter] = useState("all"); // all | cut | hold | book
  const [horizon, setHorizon] = useState("all"); // all | intraday | swing | long
  const [chatCtx, setChatCtx] = useState(null); // { type: "signal", data: s }
  const [chartCtx, setChartCtx] = useState(null); // { sym, ltp, currency, name }
  const filtered = useMemo(() => {
    return SIGNALS.filter(s => {
      if (filter !== "all") {
        if (filter === "cut" && !["CUT", "SELL"].includes(s.action)) return false;
        if (filter === "hold" && s.action !== "HOLD") return false;
        if (filter === "book" && s.action !== "BOOK PART") return false;
      }
      if (horizon !== "all") {
        if (horizon === "intraday" && s.timeframe !== "Intraday") return false;
        if (horizon === "swing"    && s.timeframe !== "Swing") return false;
        if (horizon === "long"     && s.timeframe !== "Long-term") return false;
      }
      return true;
    });
  }, [filter, horizon]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <Target size={20} color={T.primary} /> Signals
          <DemoBadge note="The 8 signals shown are illustrative demo examples generated to demonstrate the framework. In production, these would come from: (1) a real analyst desk feed, (2) an in-house quant scoring model, or (3) a third-party signal provider licensed for redistribution. What IS production-ready: the 3-axis reasoning template (Technical / Fundamental / Macro), the failure scenario field, the confidence + risk score dials (0-100), and the personalization to your holdings. Any signal you act on should be re-verified against a real source." />
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Personalized signals with 3-bullet reasoning · Technical · Fundamental · Macro
        </div>
      </div>

      {/* SEBI disclaimer */}
      <div className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30` }}>
        <Info size={13} color={T.info} className="mt-0.5 shrink-0" />
        <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
          <span className="font-semibold">Decision-support only.</span> These signals are personal analysis to help you decide buy/sell — not investment advice. Consult a SEBI-registered advisor for personalised recommendations.
        </div>
      </div>

      {/* Filters */}
      <Card padded={false} className="p-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all",  l:"All",       n:SIGNALS.length },
            { k:"cut",  l:"Cut/Sell",  n:SIGNALS.filter(s=>["CUT","SELL"].includes(s.action)).length },
            { k:"hold", l:"Hold",      n:SIGNALS.filter(s=>s.action==="HOLD").length },
            { k:"book", l:"Book Part", n:SIGNALS.filter(s=>s.action==="BOOK PART").length },
          ].map(o => (
            <button key={o.k} onClick={() => setFilter(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: filter === o.k ? T.fg : "transparent",
                color: filter === o.k ? T.bg : T.fgMute,
                border: `1px solid ${filter === o.k ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{o.l} ({o.n})</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all",      l:"Any horizon" },
            { k:"intraday", l:"Intraday" },
            { k:"swing",    l:"Swing (2-15d)" },
            { k:"long",     l:"Long-term" },
          ].map(o => (
            <button key={o.k} onClick={() => setHorizon(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: horizon === o.k ? T.card2 : "transparent",
                color: horizon === o.k ? T.fg : T.fgMute,
                border: `1px solid ${horizon === o.k ? T.primary : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </Card>

      {/* Signals list */}
      {filtered.length === 0 ? (
        <Card><div className="py-6 text-center text-[13px]" style={{ color: T.fgMute }}>No signals match your filters</div></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => <SignalCard key={s.id} s={s}
            onAskAI={() => setChatCtx({ type:"signal", data:s })}
            onOpenChart={() => setChartCtx({ sym: s.sym, ltp: s.ltp, currency: s.userPos?.currency === "USD" ? "$" : "₹", name: s.sym })} />)}
        </div>
      )}

      {chatCtx && <AIChatDrawer context={chatCtx} onClose={() => setChatCtx(null)} />}
      {chartCtx && <TechnicalChartDrawer {...chartCtx} onClose={() => setChartCtx(null)} />}
    </div>
  );
};
