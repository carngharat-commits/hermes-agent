/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { INVESTOR_MOVES } from "@/data/intelligence";
import { useBook } from "@/data/book";
import { InvestorMoveCard } from "@/features/intelligence/InvestorMoveCard";

export const BigMovesView = () => {
  const { IN_STOCKS, US_STOCKS } = useBook();
  const [filter, setFilter] = useState("mine"); // mine | all
  const [tier, setTier] = useState("all"); // all | HNI | MF | FII | PMS

  // Build set of user's symbols across IN + US
  const mySymbols = useMemo(() => {
    const s = new Set();
    [...IN_STOCKS, ...US_STOCKS].forEach(h => s.add(h.sym));
    return s;
  }, []);

  const filtered = useMemo(() => {
    return INVESTOR_MOVES.filter(m => {
      if (filter === "mine" && !mySymbols.has(m.sym)) return false;
      if (tier !== "all" && m.tier !== tier) return false;
      return true;
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [filter, tier, mySymbols]);

  const affecting = INVESTOR_MOVES.filter(m => mySymbols.has(m.sym)).length;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <div className="text-[13px] font-semibold">Top investors · this quarter</div>
              <DemoBadge note="Investor moves shown are illustrative examples based on typical Q1 FY26 filings by real investors (Jhunjhunwala family, Damani, Kacholia, Kedia, Singhania, Porinju, top MF houses, FIIs). The names + firms + investing styles are real. Specific delta %, stake %, and dates are demo values — real data source in production: BSE quarterly shareholding pattern (free scrape), Trendlyne Premium API (~₹1,500/mo), or AMFI monthly MF portfolios (free XML)." />
            </div>
            <div className="text-[11px]" style={{ color: T.fgMute }}>
              {affecting} of {INVESTOR_MOVES.length} moves touch stocks you own
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[22px] font-bold" style={{ color: T.primary, ...FONT_MONO }}>{affecting}</div>
            <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>in your book</div>
          </div>
        </div>
      </Card>

      {/* Filter chips */}
      <Card padded={false} className="p-3 space-y-2">
        <div className="flex gap-1.5">
          {[
            { k:"mine", l:`In my book (${affecting})` },
            { k:"all",  l:`All moves (${INVESTOR_MOVES.length})` },
          ].map(o => (
            <button key={o.k} onClick={() => setFilter(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex-1"
              style={{
                background: filter === o.k ? T.fg : "transparent",
                color: filter === o.k ? T.bg : T.fgMute,
                border: `1px solid ${filter === o.k ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all", l:"All investors" },
            { k:"HNI", l:"HNIs" },
            { k:"MF",  l:"Mutual Funds" },
            { k:"FII", l:"FIIs" },
            { k:"PMS", l:"PMS" },
          ].map(o => (
            <button key={o.k} onClick={() => setTier(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: tier === o.k ? T.card2 : "transparent",
                color: tier === o.k ? T.fg : T.fgMute,
                border: `1px solid ${tier === o.k ? T.primary : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </Card>

      {/* Moves list */}
      {filtered.length === 0 ? (
        <Card><div className="py-6 text-center text-[13px]" style={{ color: T.fgMute }}>
          {filter === "mine" ? "None of your holdings had notable investor moves this window." : "No moves match your filters"}
        </div></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => <InvestorMoveCard key={m.id} m={m} inMyBook={mySymbols.has(m.sym)} />)}
        </div>
      )}
    </div>
  );
};
