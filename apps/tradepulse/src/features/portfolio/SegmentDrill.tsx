/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { ArrowLeft, Lock, Search, X } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FONT_BODY, FONT_MONO, T } from "@/theme/tokens";
import { HoldingRow } from "@/features/portfolio/HoldingRow";
import { useIntel } from "@/data/useIntel";
import { useQuotes, withQuote } from "@/data/useQuotes";
import { SortMenu } from "@/features/portfolio/SortMenu";
import { cvOf, inrCompact, ivOf, pct } from "@/lib/format";

export const SegmentDrill = ({ segment, holdings: rawHoldings, onBack }: any) => {
  // Quotes for the rows on screen. A live source moves ltp and the day
  // change; a stub only fills a price that is missing.
  const segmentRows = useMemo(() => rawHoldings.filter((h: any) => h.segment === segment), [rawHoldings, segment]);
  const quotes = useQuotes(segmentRows.map((h: any) => h.sym));
  const holdings = useMemo(
    () => rawHoldings.map((h: any) => h.segment === segment ? withQuote(h, quotes.bySymbol[String(h.sym).toUpperCase()]) : h),
    [rawHoldings, segment, quotes.bySymbol],
  );
  // Intrinsic value for the rows on screen, in one batched request.
  const { bySymbol } = useIntel(holdings.filter((h: any) => h.segment === segment));
  const meta = {
    IN: { label: "Indian Equities",  brands: ["All", "Zerodha", "ABML"] },
    US: { label: "US Equities",      brands: ["All", "INDmoney"] },
    MF: { label: "Mutual Funds",     brands: ["All", "Groww", "INDmoney"] },
    PM: { label: "Precious Metals",  brands: ["All", "PhonePe"] },
    CR: { label: "Crypto",           brands: ["All", "CoinDCX", "WazirX"] },
  }[segment];

  const [brokerFilter, setBrokerFilter] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("weight");
  const [showPledged, setShowPledged] = useState(true);

  const rows = useMemo(() => {
    let list = holdings.filter(h => h.segment === segment);
    if (brokerFilter !== "All") list = list.filter(h => h.broker === brokerFilter);
    if (!showPledged) list = list.filter(h => !h.pledged);
    if (q.trim()) {
      const Q = q.trim().toLowerCase();
      list = list.filter(h => (h.sym || h.name || "").toLowerCase().includes(Q));
    }
    const withCalc = list.map(h => {
      const cv = cvOf(h), iv = ivOf(h);
      const pl = cv - iv;
      const plPct = iv > 0 ? (pl / iv) * 100 : 0;
      return { ...h, cv, iv, pl, plPct, weightVal: cv };
    });
    const sorters = {
      weight: (a, b) => b.weightVal - a.weightVal,
      pl:     (a, b) => b.pl - a.pl,
      plpct:  (a, b) => b.plPct - a.plPct,
      alpha:  (a, b) => (a.sym || a.name || "").localeCompare(b.sym || b.name || ""),
    };
    return withCalc.sort(sorters[sort]);
  }, [holdings, segment, brokerFilter, q, sort, showPledged]);

  const totalCV = rows.reduce((s, h) => s + h.cv, 0);
  const totalIV = rows.reduce((s, h) => s + h.iv, 0);
  const totalPL = totalCV - totalIV;
  const totalPct = totalIV > 0 ? (totalPL / totalIV) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-md" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
          <ArrowLeft size={14} color={T.fg} />
        </button>
        <div>
          <div className="text-[19px] font-bold tracking-tight">{meta.label}</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.fgMute, ...FONT_MONO }}>
            {rows.length} rows · {inrCompact(totalCV)} · <span style={{ color: totalPL >= 0 ? T.up : T.down }}>{pct(totalPct, 2)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card padded={false} className="p-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
          {meta.brands.map(b => (
            <button key={b} onClick={() => setBrokerFilter(b)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: brokerFilter === b ? T.fg : "transparent",
                color: brokerFilter === b ? T.bg : T.fgMute,
                border: `1px solid ${brokerFilter === b ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{b}</button>
          ))}
          {segment === "IN" && (
            <button onClick={() => setShowPledged(!showPledged)}
              className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
              style={{ background: T.card2, color: showPledged ? T.fg : T.fgMute, border: `1px solid ${T.border}`, ...FONT_MONO }}>
              <Lock size={11} /> {showPledged ? "Pledged shown" : "Pledged hidden"}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: T.card2, border: `1px solid ${T.border}` }}>
            <Search size={13} color={T.fgMute} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder={segment === "MF" ? "Search fund" : "Search symbol"}
              className="bg-transparent outline-none text-[12.5px] w-full" style={FONT_BODY} />
            {q && <button onClick={() => setQ("")}><X size={13} color={T.fgMute} /></button>}
          </div>
          <SortMenu value={sort} onChange={setSort} />
        </div>
      </Card>

      {/* Rows */}
      <Card padded={false}>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px]" style={{ color: T.fgMute }}>No matches</div>
        ) : (
          rows.map(h => (
            <HoldingRow key={`${h.broker}-${h.sym || h.name}-${h.pledged ? "P" : "F"}`} h={h} segment={segment} intel={bySymbol[h.sym]} />
          ))
        )}
      </Card>
    </div>
  );
};
