/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { AlertTriangle, BarChart3, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { MiniStat } from "@/components/ui/MiniStat";
import { Pill } from "@/components/ui/Pill";

export const OpportunityCard = ({ o, onAskAI, onOpenChart }: any) => {
  const inBook = o.inYourBook;
  const catColor = {
    "Breakout": T.up, "Oversold Bounce": T.warn, "Sector Rotation": T.info,
    "Momentum": T.violet, "Undervalued": T.primary, "Overweight Alert": T.warn,
  }[o.category] || T.fg;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[15px] font-bold tracking-tight" style={FONT_MONO}>{o.sym}</span>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
              style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}40`, ...FONT_MONO }}>
              {o.category}
            </span>
            <Pill tone="neutral" size="xs">{o.mcap} · {o.sector}</Pill>
            {inBook && <Pill tone="warn" size="xs">In your book</Pill>}
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: T.fg }}>{o.why}</div>
          {!inBook && o.entryLo && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              <MiniStat label="LTP" v={`₹${o.ltp}`} />
              <MiniStat label="Entry" v={`₹${o.entryLo}-${o.entryHi}`} />
              <MiniStat label="Target" v={`₹${o.target}`} tone="up" />
              <MiniStat label="R:R" v={`1:${o.rr.toFixed(1)}`} tone="up" />
            </div>
          )}
          {inBook && (
            <div className="mt-3 p-2.5 rounded-lg flex items-center gap-2" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30` }}>
              <AlertTriangle size={12} color={T.warn} />
              <span className="text-[11px]" style={{ color: T.fg }}>
                Already own — this is not a fresh entry idea, review position in Signals tab.
              </span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Confidence</div>
          <div className="text-[20px] font-bold" style={{ color: o.confidence >= 75 ? T.up : o.confidence >= 60 ? T.warn : T.fgMute, ...FONT_MONO }}>
            {o.confidence}
          </div>
          <div className="text-[9.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{o.timeframe}</div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onOpenChart && onOpenChart()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors"
          style={{ background: `${T.info}18`, color: T.info, border: `1px solid ${T.info}40` }}>
          <BarChart3 size={12} /> Chart
        </button>
        <button
          onClick={() => onAskAI && onAskAI()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors"
          style={{ background: `${T.primary}18`, color: T.primary, border: `1px solid ${T.primary}30` }}>
          <Sparkles size={12} /> Ask AI · why {o.sym}?
        </button>
      </div>
    </Card>
  );
};
