/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { STRESS_SCENARIOS } from "@/data/risk";
import { inrCompact } from "@/lib/format";

export const StressTable = ({ scenario, totals }: any) => {
  // Compute segment-level impacts using scenario deltas
  const inLoss = totals.inCV * (STRESS_SCENARIOS[0].sectorImpacts.Others / 100); // avg
  const usLoss = totals.usCV * (STRESS_SCENARIOS[0].globalUSImpact / 100);
  const mfLoss = totals.mfCV * (STRESS_SCENARIOS[0].mfImpact / 100);
  const crLoss = totals.crCV * (STRESS_SCENARIOS[0].cryptoImpact / 100);
  const totalLoss = inLoss + usLoss + mfLoss + crLoss;
  const rows = [
    { k:"Indian Equities", v:totals.inCV, l:inLoss, p:(inLoss / totals.inCV) * 100 },
    { k:"US Equities",     v:totals.usCV, l:usLoss, p:(usLoss / totals.usCV) * 100 },
    { k:"Mutual Funds",    v:totals.mfCV, l:mfLoss, p:(mfLoss / totals.mfCV) * 100 },
    { k:"Crypto",          v:totals.crCV, l:crLoss, p:(crLoss / totals.crCV) * 100 },
  ];
  return (
    <div>
      <table className="w-full text-[12px]">
        <thead>
          <tr>
            <th className="text-left pb-2" style={{ color: T.fgMute, fontWeight: 600 }}>Segment</th>
            <th className="text-right pb-2" style={{ color: T.fgMute, fontWeight: 600 }}>Value</th>
            <th className="text-right pb-2" style={{ color: T.fgMute, fontWeight: 600 }}>Impact</th>
            <th className="text-right pb-2" style={{ color: T.fgMute, fontWeight: 600 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.k} style={{ borderTop: `1px solid ${T.border}` }}>
              <td className="py-2">{r.k}</td>
              <td className="py-2 text-right" style={FONT_MONO}>{inrCompact(r.v)}</td>
              <td className="py-2 text-right font-semibold" style={{ color: T.down, ...FONT_MONO }}>
                {inrCompact(r.l)}
              </td>
              <td className="py-2 text-right" style={{ color: T.down, ...FONT_MONO }}>{r.p.toFixed(1)}%</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${T.border}` }}>
            <td className="py-2 font-bold">Total draw-down</td>
            <td className="py-2 text-right font-bold" style={FONT_MONO}>{inrCompact(totals.total)}</td>
            <td className="py-2 text-right font-bold" style={{ color: T.down, ...FONT_MONO }}>
              {inrCompact(totalLoss)}
            </td>
            <td className="py-2 text-right font-bold" style={{ color: T.down, ...FONT_MONO }}>
              {((totalLoss / totals.total) * 100).toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
