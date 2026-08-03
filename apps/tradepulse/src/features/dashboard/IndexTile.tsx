/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { pct } from "@/lib/format";

export const IndexTile = ({ name, data, lowerIsBetter }: any) => {
  const up = lowerIsBetter ? data.chgPct <= 0 : data.chgPct >= 0;
  return (
    <div className="p-3 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.fgMute, ...FONT_MONO }}>{name}</div>
      <div className="text-[16px] font-bold mt-1" style={FONT_MONO}>
        {data.val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="text-[11px] font-semibold mt-0.5" style={{ color: up ? T.up : T.down, ...FONT_MONO }}>
        {data.chg > 0 ? "+" : ""}{data.chg.toFixed(2)} · {pct(data.chgPct, 2)}
      </div>
    </div>
  );
};
