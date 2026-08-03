/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Calendar } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { SEASONAL } from "@/data/intelligence";

export const SeasonalPatternsView = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader
        title={`Aug-Sep Seasonal Patterns · 10-yr history`}
        subtitle="How your sectors have historically performed in this window"
        icon={Calendar} />
      <div className="space-y-2">
        {SEASONAL.sectors.map(s => {
          const c = { up:T.up, down:T.down, warn:T.warn, neutral:T.fgMute }[s.tone] || T.fgMute;
          return (
            <div key={s.sec} className="p-3 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: T.fg }}>{s.sec}</span>
                  <span className="text-[13.5px] font-bold" style={{ color: c, ...FONT_MONO }}>
                    {s.historicalPct >= 0 ? "+" : "−"}{Math.abs(s.historicalPct).toFixed(1)}%
                  </span>
                </div>
                <span className="text-[10.5px]" style={{ color: T.fgMute }}>10-yr avg</span>
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: T.fgMute }}>{s.note}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {s.stocks.map(x => (
                  <span key={x} className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: T.subtle, color: T.fg, ...FONT_MONO }}>
                    {x}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  </div>
);
