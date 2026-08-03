/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";

export const InvestorMoveCard = ({ m, inMyBook }: any) => {
  const actionColor = m.action === "BOUGHT" ? T.up
                    : m.action === "SOLD" || m.action === "TRIMMED" ? T.down
                    : T.fgMute;
  const tierColor = { HNI:T.violet, MF:T.info, FII:"#22d3ee", PMS:T.warn }[m.tier] || T.fgMute;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
          {m.investor.split(" ").map(x => x[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[12.5px] font-semibold">{m.investor}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
              style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40`, ...FONT_MONO }}>
              {m.tier}
            </span>
            {inMyBook && <Pill tone="up" size="xs">In your book</Pill>}
          </div>
          <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{m.entity} · {m.when}</div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ background: `${actionColor}18`, color: actionColor, border: `1px solid ${actionColor}40`, ...FONT_MONO }}>
              {m.action}
            </span>
            <span className="text-[13.5px] font-bold" style={FONT_MONO}>{m.sym}</span>
            {m.delta !== 0 && (
              <span className="text-[11px] font-semibold" style={{ color: actionColor, ...FONT_MONO }}>
                {m.delta > 0 ? "+" : ""}{m.delta.toFixed(2)}%
              </span>
            )}
            <span className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
              → {m.newStake}% stake · ₹{m.valueCr.toLocaleString("en-IN")} Cr
            </span>
          </div>
          <div className="text-[11.5px] leading-relaxed mt-2" style={{ color: T.fg }}>{m.logic}</div>
        </div>
      </div>
    </Card>
  );
};
