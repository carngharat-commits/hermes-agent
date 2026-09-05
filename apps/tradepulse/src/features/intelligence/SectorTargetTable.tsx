/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { useBook } from "@/data/book";
import { SECTOR } from "@/data/taxonomy";

export const SectorTargetTable = () => {
  const { IN_STOCKS } = useBook();
  // Compute user's current sector weights from IN holdings
  const inH = IN_STOCKS;
  const sectorMap: Record<string, number> = {};
  inH.forEach(h => {
    const s = SECTOR[h.sym] || "Others";
    sectorMap[s] = (sectorMap[s] || 0) + h.qty * h.ltp;
  });
  const total = Object.values(sectorMap).reduce((s, v) => s + v, 0);
  const targets = {
    Consumer: 15, Utilities: 12, Pharma: 8, Banking: 18, Financials: 10,
    IT: 8, Energy: 8, Auto: 6, Metals: 5, Others: 10,
  };
  const rows = Object.keys(targets).map(sec => {
    const w = ((sectorMap[sec] || 0) / total * 100);
    const t = targets[sec];
    const delta = w - t;
    return { sec, w, t, delta };
  }).sort((a, b) => b.w - a.w);
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.sec} className="flex items-center gap-3">
          <div className="w-24 text-[11.5px] font-semibold shrink-0" style={{ color: T.fg }}>{r.sec}</div>
          <div className="flex-1 relative">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: T.subtle }}>
              <div className="h-full" style={{ width: `${Math.min(100, r.w * 3)}%`, background: T.info, opacity: 0.7 }} />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4"
              style={{ left: `${Math.min(100, r.t * 3)}%`, background: T.warn }} />
          </div>
          <div className="w-14 text-right text-[10.5px] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>
            {r.w.toFixed(1)}%
          </div>
          <div className="w-12 text-right text-[10.5px] font-semibold" style={{ color: Math.abs(r.delta) < 2 ? T.up : r.delta > 0 ? T.warn : T.down, ...FONT_MONO }}>
            {r.delta >= 0 ? "+" : "−"}{Math.abs(r.delta).toFixed(1)}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 mt-3 pt-3 text-[10px]" style={{ borderTop: `1px solid ${T.border}`, color: T.fgMute, ...FONT_MONO }}>
        <span><span style={{ background: T.info, display: "inline-block", width: 8, height: 8, borderRadius: 2 }}></span> Your weight</span>
        <span><span style={{ background: T.warn, display: "inline-block", width: 2, height: 10 }}></span> Late-cycle target</span>
      </div>
    </div>
  );
};
