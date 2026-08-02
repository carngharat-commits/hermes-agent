/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { SECTOR } from "@/data/taxonomy";

export const SectorRotationView = ({ holdings }: any) => {
  // Which sectors user is over/under-weighted in for the current cycle phase
  const equityHoldings = holdings.filter(h => h.segment === "IN");
  const sectorMap: Record<string, number> = {};
  equityHoldings.forEach(h => {
    const s = SECTOR[h.sym] || "Others";
    sectorMap[s] = (sectorMap[s] || 0) + h.qty * h.ltp;
  });
  const total = Object.values(sectorMap).reduce((s, v) => s + v, 0);

  // Late Cycle: favor Defensives, Consumer Staples, Utilities, Pharma
  const favored = ["Consumer", "Utilities", "Pharma", "Banking"];
  const avoid = ["Auto", "Metals", "Infra"];

  const rows = [
    ...favored.map(s => ({ sec: s, tone: "up", label: "Favored", w: sectorMap[s] || 0 })),
    ...avoid.map(s   => ({ sec: s, tone: "down", label: "Avoid",   w: sectorMap[s] || 0 })),
  ];

  return (
    <div className="space-y-2">
      {rows.map(r => {
        const share = total > 0 ? (r.w / total) * 100 : 0;
        return (
          <div key={r.sec} className="flex items-center gap-3">
            <div className="w-20 text-[11.5px] font-semibold" style={{ color: T.fg }}>{r.sec}</div>
            <Pill tone={r.tone === "up" ? "up" : "down"} size="xs">{r.label}</Pill>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.subtle }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 2)}%`, background: r.tone === "up" ? T.up : T.down }} />
            </div>
            <div className="text-[11px] font-semibold w-12 text-right" style={{ ...FONT_MONO, color: T.fgMute }}>{share.toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
};
