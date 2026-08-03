/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { MARKET } from "@/data/market";
import { pct } from "@/lib/format";

export const MarketTicker = () => {
  const items = [
    { k: "NIFTY 50",  v: MARKET.nifty.val,     p: MARKET.nifty.chgPct },
    { k: "SENSEX",    v: MARKET.sensex.val,    p: MARKET.sensex.chgPct },
    { k: "BANKNIFTY", v: MARKET.banknifty.val, p: MARKET.banknifty.chgPct },
    { k: "INDIAVIX",  v: MARKET.indiavix.val,  p: MARKET.indiavix.chgPct },
  ];
  return (
    <div className="hidden md:flex items-center gap-4 overflow-x-auto no-scrollbar">
      {items.map(x => (
        <div key={x.k} className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>{x.k}</span>
          <span className="text-[11.5px] font-semibold" style={{ color: T.fg, ...FONT_MONO }}>
            {typeof x.v === "number" ? x.v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : x.v}
          </span>
          <span className="text-[10.5px] font-semibold" style={{ color: x.p >= 0 ? T.up : T.down, ...FONT_MONO }}>
            {pct(x.p, 2)}
          </span>
        </div>
      ))}
    </div>
  );
};
