/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { BarChart3, Info, Sparkles, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { VolumeRule } from "@/features/chart/VolumeRule";
import { analyzeVolume, genChartData } from "@/lib/chart";

export const TechnicalChartDrawer = ({ sym, ltp, name, currency = "₹", onClose }: any) => {
  const [tf, setTf] = useState("3M");
  const chart = useMemo(() => genChartData(sym, ltp, tf), [sym, ltp, tf]);
  const stats = useMemo(() => {
    const prices = chart.data.map(d => d.price);
    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      avgVolume: chart.avgVolume,
      currentVol: chart.data[chart.data.length - 1].volume,
    };
  }, [chart]);
  const volAnalysis = useMemo(() => analyzeVolume(chart, ltp), [chart, ltp]);
  const startPrice = chart.data[0].price;
  const changePct = ((ltp - startPrice) / startPrice) * 100;
  const trendColor = changePct >= 0 ? T.up : T.down;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[640px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`, height: "92vh", maxHeight: "820px" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 shrink-0" style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold" style={FONT_MONO}>{sym}</span>
              <DemoBadge note="Chart uses seeded synthetic OHLCV — deterministic per symbol so bars stay stable across renders, but not real historical data. In production this would source from your broker's historical candle API (Kite Historical, ₹100 extra/mo for 1-min candles) or a paid data feed (TrueData ₹1,500/mo, GlobalDataFeeds). The volume interpretation logic (buying / selling / weak rally / consolidation classification) is production-ready and would work identically with real data." />
            </div>
            {name && <div className="text-[10.5px] mt-0.5 truncate" style={{ color: T.fgMute }}>{name}</div>}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[15px] font-bold" style={FONT_MONO}>{currency}{ltp.toFixed(2)}</span>
              <span className="text-[11px] font-semibold" style={{ color: trendColor, ...FONT_MONO }}>
                {changePct >= 0 ? "+" : "−"}{Math.abs(changePct).toFixed(2)}% · {tf}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.card2 }}>
            <X size={15} color={T.fgMute} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* Timeframe */}
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
            {["1D", "5D", "1M", "3M", "6M", "1Y"].map(o => (
              <button key={o} onClick={() => setTf(o)}
                className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
                style={{
                  background: tf === o ? T.primary : "transparent",
                  color: tf === o ? T.bg : T.fgMute,
                  ...FONT_MONO,
                }}>{o}</button>
            ))}
          </div>

          {/* Price chart */}
          <Card>
            <div className="text-[10.5px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
              Price · with 20-DMA
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`px-${sym}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={trendColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: T.fgDim, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                    axisLine={{ stroke: T.border }} tickLine={false}
                    interval={Math.max(1, Math.floor(chart.data.length / 6))} />
                  <YAxis hide domain={[stats.low * 0.98, stats.high * 1.02]} />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: T.fgMute }}
                    formatter={(v, name) => [`${currency}${v}`, name === "price" ? "Price" : name === "ma20" ? "20-DMA" : name]} />
                  <Area type="monotone" dataKey="price" stroke={trendColor} strokeWidth={2} fill={`url(#px-${sym})`} />
                  <Line type="monotone" dataKey="ma20" stroke={T.warn} strokeWidth={1.2} dot={false} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Volume chart */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>
                Volume · Green = accumulation · Red = distribution
              </div>
              <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                Avg: {(stats.avgVolume / 1000).toFixed(0)}K
              </div>
            </div>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: T.fgDim, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                    axisLine={{ stroke: T.border }} tickLine={false}
                    interval={Math.max(1, Math.floor(chart.data.length / 6))} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: T.fgMute }}
                    formatter={(v) => [`${(v / 1000).toFixed(0)}K`, "Volume"]} />
                  <Bar dataKey="volume">
                    {chart.data.map((d, i) => (
                      <Cell key={i} fill={d.up ? `${T.up}CC` : `${T.down}CC`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KV k={`${tf} High`}     v={`${currency}${stats.high.toFixed(2)}`} tone="up" />
            <KV k={`${tf} Low`}      v={`${currency}${stats.low.toFixed(2)}`} tone="down" />
            <KV k="Avg volume"       v={`${(stats.avgVolume / 1000).toFixed(0)}K`} />
            <KV k="Latest volume"    v={`${(stats.currentVol / 1000).toFixed(0)}K`}
                tone={volAnalysis.volRatio > 1.5 ? "up" : volAnalysis.volRatio < 0.8 ? "down" : "neutral"}
                sub={`${volAnalysis.volRatio.toFixed(1)}× avg`} />
          </div>

          {/* Volume Analysis */}
          <Card>
            <CardHeader title="Volume Pattern · Right now" subtitle="What the last 10 sessions tell us" icon={BarChart3}
              right={<Pill tone={volAnalysis.tone === "up" ? "up" : volAnalysis.tone === "down" ? "down" : volAnalysis.tone === "warn" ? "warn" : "info"}>{volAnalysis.signal}</Pill>} />
            <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: T.fg }}>{volAnalysis.verdict}</div>
            <div className="p-3 rounded-lg" style={{ background: `${T.primary}10`, border: `1px solid ${T.primary}30` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={11} color={T.primary} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.primary, ...FONT_MONO }}>
                  What to do about it
                </span>
              </div>
              <div className="text-[12px] leading-relaxed" style={{ color: T.fg }}>{volAnalysis.action}</div>
            </div>
          </Card>

          {/* Decision framework — how volume helps */}
          <Card>
            <CardHeader title="How volume helps your decision" subtitle="A quick playbook for reading these bars" icon={Info} />
            <div className="space-y-2.5 text-[12px]">
              <VolumeRule tone="up"    label="Volume UP + Price UP"     text="Strong buying. Institutions are accumulating. Bullish trends with rising volume have higher continuation probability." />
              <VolumeRule tone="down"  label="Volume UP + Price DOWN"   text="Strong selling / distribution. Bearish signal. Volume-heavy declines rarely reverse quickly." />
              <VolumeRule tone="warn"  label="Volume DOWN + Price UP"   text="Weak rally. Few buyers driving the move; risk of reversal. Don't chase — wait for confirmation." />
              <VolumeRule tone="warn"  label="Volume DOWN + Price DOWN" text="Weak selling. Sellers exhausted; watch for reversal signals in the next 2-3 sessions." />
              <VolumeRule tone="info"  label="Volume SPIKE (2×+ avg)"   text="Something happened — earnings, news, block deal. Investigate before acting; can precede trend or fake-out." />
              <VolumeRule tone="info"  label="Volume DRY-UP"             text="Consolidation. Market waiting for catalyst. Wait for volume-backed breakout in either direction before positioning." />
              <VolumeRule tone="down"  label="Divergence"                text="Price making new highs but volume trending down = warning of exhaustion. Trim into strength." />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
