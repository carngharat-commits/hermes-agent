/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { PORTFOLIO_HISTORY, _genHistory } from "@/data/market";
import { inrCompact, pct } from "@/lib/format";

export const PortfolioHistoryChart = ({ totals }: any) => {
  const [tf, setTf] = useState("1M");
  const tfOptions = [
    { k:"7D",  l:"7D" },
    { k:"1M",  l:"1M" },
    { k:"3M",  l:"3M" },
    { k:"1Y",  l:"1Y" },
    { k:"All", l:"All" },
  ];
  const config = PORTFOLIO_HISTORY[tf];
  const data = useMemo(() => {
    const values = _genHistory(config.points, totals.totalCV, config.vol, config.seed);
    const today = new Date("2026-07-31");
    return values.map((v, i) => {
      const daysAgo = Math.round(config.startDaysAgo * (1 - i / (config.points - 1)));
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      return {
        i,
        v,
        label: tf === "7D" ? d.toLocaleDateString("en-IN", { weekday:"short", day:"numeric" })
             : tf === "1M" ? d.toLocaleDateString("en-IN", { day:"numeric", month:"short" })
             : tf === "3M" ? d.toLocaleDateString("en-IN", { day:"numeric", month:"short" })
             : tf === "1Y" ? d.toLocaleDateString("en-IN", { month:"short", year:"2-digit" })
             : d.toLocaleDateString("en-IN", { month:"short", year:"2-digit" }),
      };
    });
  }, [tf, totals.totalCV]);

  const startValue = data[0]?.v || 0;
  const endValue = data[data.length - 1]?.v || 0;
  const change = endValue - startValue;
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0;
  const color = change >= 0 ? T.up : T.down;
  const minV = Math.min(...data.map(d => d.v));
  const maxV = Math.max(...data.map(d => d.v));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>
            Portfolio value over time
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-[22px] font-bold" style={FONT_MONO}>{inrCompact(endValue)}</span>
            <span className="text-[13px] font-semibold" style={{ color, ...FONT_MONO }}>
              {change >= 0 ? "+" : "−"}{inrCompact(Math.abs(change))} · {pct(changePct, 2)}
            </span>
            <span className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>past {tf}</span>
          </div>
        </div>

        {/* Timeframe selector — 7D / 1M / 3M / 1Y / All */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
          {tfOptions.map(o => (
            <button key={o.k} onClick={() => setTf(o.k)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
              style={{
                background: tf === o.k ? T.primary : "transparent",
                color: tf === o.k ? "#000" : T.fgMute,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:5, right:5, left:5, bottom:5 }}>
            <defs>
              <linearGradient id="pfGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: T.fgDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              axisLine={{ stroke: T.border }} tickLine={false}
              interval={tf === "7D" ? 0 : tf === "1M" ? 4 : tf === "3M" ? 7 : tf === "1Y" ? 8 : 9} />
            <YAxis hide domain={[minV * 0.98, maxV * 1.02]} />
            <Tooltip
              contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
              labelStyle={{ color: T.fgMute, fontSize: 10 }}
              formatter={(v) => [inrCompact(v), "Net worth"]}
            />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#pfGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
