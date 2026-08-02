/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Cpu, Info, Lock, RefreshCw, Settings, Sparkles, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Btn } from "@/components/ui/Btn";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { MiniStat } from "@/components/ui/MiniStat";
import { ParamSlider } from "@/features/algo/ParamSlider";
import { Pill } from "@/components/ui/Pill";
import { STRATEGIES } from "@/data/signals";

export const AlgoTab = () => {
  const [selectedK, setSelectedK] = useState(STRATEGIES[0].k);
  const selected = STRATEGIES.find(s => s.k === selectedK);
  const [params, setParams] = useState(() => {
    const init = {};
    STRATEGIES.forEach(s => { init[s.k] = {}; s.params.forEach(p => { init[s.k][p.k] = p.def; }); });
    return init;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <Cpu size={20} color={T.primary} /> Algo Strategies
          </h1>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            Backtestable strategy templates · SEBI-compliant deployment via approved brokers
          </div>
        </div>
        <Pill tone="warn"><Lock size={9} /> Deployment coming soon</Pill>
      </div>

      {/* SEBI Framework banner */}
      <div className="p-3 rounded-lg" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30` }}>
        <div className="flex items-start gap-2">
          <Info size={13} color={T.info} className="mt-0.5 shrink-0" />
          <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
            <span className="font-semibold">SEBI Algo Framework:</span> As per SEBI's April 2025 circular, all algo orders must be routed through broker-approved algo providers (Tradetron, Streak, Algobaba, etc.) and tagged with unique strategy IDs. Direct execution from third-party platforms is restricted.
          </div>
        </div>
      </div>

      {/* Strategy picker */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {STRATEGIES.map(s => (
          <button key={s.k} onClick={() => setSelectedK(s.k)}
            className="p-3 rounded-lg text-left transition-colors"
            style={{
              background: selectedK === s.k ? `${T.primary}18` : T.card2,
              border: `1px solid ${selectedK === s.k ? T.primary : T.border}`,
            }}>
            <div className="text-[9.5px] uppercase tracking-widest font-semibold mb-1"
              style={{ color: selectedK === s.k ? T.primary : T.fgDim, ...FONT_MONO }}>
              {s.category}
            </div>
            <div className="text-[12px] font-semibold leading-tight" style={{ color: T.fg }}>{s.name}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <Pill tone={s.risk === "LOW" ? "up" : s.risk === "MED" ? "warn" : "down"} size="xs">{s.risk} risk</Pill>
            </div>
          </button>
        ))}
      </div>

      {/* Selected strategy detail */}
      <Card>
        <CardHeader title={selected.name} subtitle={selected.desc} icon={Sparkles}
          right={<div className="flex items-center gap-1.5">
            <Pill tone={selected.risk === "LOW" ? "up" : selected.risk === "MED" ? "warn" : "down"}>{selected.risk} risk</Pill>
            <DemoBadge note="Backtest stats (CAGR, max drawdown, Sharpe, win rate, trades, avg hold) and the equity curve are illustrative hand-crafted arrays, NOT from a real backtest engine. In production, a real backtest requires: (1) clean historical OHLCV data with corporate actions applied, (2) transaction cost modeling (STT/GST/brokerage/slippage), (3) survivorship-bias-free universe, (4) walk-forward or out-of-sample validation. Common providers: Backtrader, VectorBT, Zipline, or broker-provided Streak/Tradetron backtest engines. Treat these numbers as demonstrating the UI layout, not as tradable strategy performance." />
          </div>} />

        {/* Backtest stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          <MiniStat label="CAGR"     v={`${selected.backtest.cagr.toFixed(1)}%`}   tone={selected.backtest.cagr >= 15 ? "up" : "neutral"} />
          <MiniStat label="Max DD"   v={`${selected.backtest.dd.toFixed(1)}%`}     tone="down" />
          <MiniStat label="Sharpe"   v={selected.backtest.sharpe.toFixed(2)}       tone={selected.backtest.sharpe >= 1.5 ? "up" : "neutral"} />
          <MiniStat label="Win rate" v={`${selected.backtest.winRate}%`}           tone={selected.backtest.winRate >= 60 ? "up" : "neutral"} />
          <MiniStat label="Trades"   v={selected.backtest.trades.toString()}       tone="neutral" />
          <MiniStat label="Avg hold" v={`${selected.backtest.avgHoldDays}d`}       tone="neutral" />
        </div>

        {/* Equity curve chart */}
        <div className="text-[10.5px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
          Backtest equity curve · past 30 rebalances
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={selected.equity.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`eq-${selected.k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={T.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.primary} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="i" hide />
              <YAxis hide domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: T.fgMute }}
                formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Portfolio"]}
              />
              <Area type="monotone" dataKey="v" stroke={T.primary} strokeWidth={2} fill={`url(#eq-${selected.k})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>
          <span>Start ₹10,000</span>
          <span>End ₹{selected.equity[selected.equity.length - 1].toLocaleString("en-IN")}</span>
        </div>
      </Card>

      {/* Parameters */}
      <Card>
        <CardHeader title="Parameters" subtitle="Adjust and re-run backtest (mock)" icon={Settings} />
        <div className="space-y-3">
          {selected.params.map(p => (
            <ParamSlider key={p.k} p={p}
              value={params[selected.k][p.k]}
              onChange={v => setParams({ ...params, [selected.k]: { ...params[selected.k], [p.k]: v } })} />
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Btn variant="secondary" className="flex-1" onClick={() => alert(`Re-running backtest for ${selected.name} with your parameters...\n\nMock: In production, this triggers a full historical simulation with your current parameter set.`)}>
            <RefreshCw size={13} /> Re-run backtest
          </Btn>
          <Btn className="flex-1" onClick={() => alert("Deployment requires broker-approved algo provider — see Accounts tab.")}>
            <Zap size={13} /> Deploy
          </Btn>
        </div>
      </Card>

      {/* Deploy providers */}
      <Card>
        <CardHeader title="Approved deployment partners" subtitle="Broker-approved algo providers" icon={Cpu} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { n:"Tradetron",     s:"Zerodha · Upstox · Angel", live:true },
            { n:"Streak",        s:"Zerodha · Kite native",    live:true },
            { n:"Algobaba",      s:"Multi-broker",             live:false },
            { n:"AlgoTest",      s:"Zerodha · Fyers",          live:false },
          ].map(p => (
            <div key={p.n} className="p-3 rounded-lg"
              style={{ background: T.card2, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12.5px] font-semibold">{p.n}</span>
                {p.live && <Pill tone="up" size="xs">Live</Pill>}
              </div>
              <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{p.s}</div>
              <button
                onClick={() => alert(p.live
                  ? `Connect to ${p.n}\n\nStep 1: Sign in / sign up at ${p.n}\nStep 2: Link your ${p.s.split(" · ")[0]} broker account\nStep 3: Deploy this strategy via ${p.n}'s dashboard\n\nTradePulse continues to monitor holdings + P&L in this app.`
                  : `${p.n} integration is under development. We'll notify you when it's available.`
                )}
                className="w-full mt-2 py-1.5 rounded text-[10.5px] font-semibold"
                style={{
                  background: p.live ? `${T.primary}18` : T.subtle,
                  color: p.live ? T.primary : T.fgMute,
                  border: `1px solid ${p.live ? `${T.primary}40` : T.border}`,
                  ...FONT_MONO,
                }}>
                {p.live ? "Connect →" : "Coming soon"}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
