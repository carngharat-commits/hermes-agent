/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";

import { AIChatDrawer } from "@/features/ai/AIChatDrawer";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { OPPORTUNITIES } from "@/data/signals";
import { OpportunityCard } from "@/features/opportunities/OpportunityCard";
import { TechnicalChartDrawer } from "@/features/chart/TechnicalChartDrawer";

export const OpportunitiesTab = () => {
  const [cat, setCat] = useState("all");
  const [mcap, setMcap] = useState("all");
  const [chatCtx, setChatCtx] = useState(null);
  const [chartCtx, setChartCtx] = useState(null);
  const cats = [
    { k:"all", l:"All" },
    { k:"Breakout", l:"Breakout" },
    { k:"Oversold Bounce", l:"Oversold" },
    { k:"Sector Rotation", l:"Sector" },
    { k:"Momentum", l:"Momentum" },
    { k:"Undervalued", l:"Value" },
    { k:"Overweight Alert", l:"Own already" },
  ];
  const filtered = useMemo(() => {
    return OPPORTUNITIES.filter(o => {
      if (cat !== "all" && o.category !== cat) return false;
      if (mcap !== "all" && o.mcap !== mcap) return false;
      return true;
    }).sort((a, b) => b.confidence - a.confidence);
  }, [cat, mcap]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <TrendingUp size={20} color={T.primary} /> Opportunities
          <DemoBadge note="The 8 scanner results are illustrative demo examples. In production, these would come from a real screener engine running against live technical + fundamental + sentiment factors. The framework is production-ready: (1) categorization (Breakout / Oversold / Sector Rotation / Momentum / Value), (2) confidence-weighted ranking, (3) automatic cross-check against your holdings to flag double-exposure, (4) filters by market cap. Any opportunity you act on should be re-verified against a live source." />
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Market scanner — ranked by confidence · cross-checked against your holdings
        </div>
      </div>

      <Card padded={false} className="p-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {cats.map(o => (
            <button key={o.k} onClick={() => setCat(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: cat === o.k ? T.fg : "transparent",
                color: cat === o.k ? T.bg : T.fgMute,
                border: `1px solid ${cat === o.k ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all",   l:"Any cap" },
            { k:"Large", l:"Large" },
            { k:"Mid",   l:"Mid" },
            { k:"Small", l:"Small" },
          ].map(o => (
            <button key={o.k} onClick={() => setMcap(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: mcap === o.k ? T.card2 : "transparent",
                color: mcap === o.k ? T.fg : T.fgMute,
                border: `1px solid ${mcap === o.k ? T.primary : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><div className="py-6 text-center text-[13px]" style={{ color: T.fgMute }}>No opportunities match your filters</div></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => <OpportunityCard key={o.id} o={o}
            onAskAI={() => setChatCtx({ type:"opportunity", data:o })}
            onOpenChart={() => setChartCtx({ sym: o.sym, ltp: o.ltp, currency: "₹", name: o.sym })} />)}
        </div>
      )}

      {chatCtx && <AIChatDrawer context={chatCtx} onClose={() => setChatCtx(null)} />}
      {chartCtx && <TechnicalChartDrawer {...chartCtx} onClose={() => setChartCtx(null)} />}
    </div>
  );
};
