import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Gauge, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";
import { FONT_MONO, T } from "@/theme/tokens";
import { getCoverage, getPerformance, type Coverage, type Performance } from "@/api/intel";

const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

/**
 * AI Performance — what the recommendations were actually worth.
 *
 * Everything here is measured per unit of capital committed, not in rupees:
 * position sizing is the user's decision, and inventing one would fabricate
 * the headline number.
 */
export const PerformanceTab = () => {
  const [data, setData] = useState<Performance | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPerformance(), getCoverage()])
      .then(([p, c]) => {
        if (cancelled) return;
        setData(p);
        setCoverage(c);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <Gauge size={20} color={T.primary} /> AI Performance
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Every recommendation, scored against what prices actually did
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg flex items-start gap-2"
          style={{ background: `${T.down}10`, border: `1px solid ${T.down}30` }}>
          <AlertTriangle size={13} color={T.down} className="mt-0.5 shrink-0" />
          <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>{error}</div>
        </div>
      )}

      {totals && totals.total_recommendations === 0 && (
        <Card>
          <div className="text-[12.5px] leading-relaxed" style={{ color: T.fgMute }}>
            No recommendations recorded yet. The AI writes one every time it forms
            a view on a symbol; this page starts reporting once calls are old
            enough to judge — under a week, a return is noise, so they stay open.
          </div>
        </Card>
      )}

      {totals && totals.total_recommendations > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><KV k="Recommendations" v={totals.total_recommendations.toString()}
              sub={`${totals.judged} judged · ${totals.open} open`} /></Card>
            <Card><KV k="Accuracy" v={pct(totals.accuracy, 0)} tone="primary"
              sub="Of calls old enough to score" /></Card>
            <Card><KV k="Win rate" v={pct(totals.win_rate, 0)}
              sub="Calls that made money" /></Card>
            <Card><KV k="Average return" v={pct(totals.average_return)}
              tone={(totals.average_return ?? 0) >= 0 ? "up" : "down"}
              sub="Per followed call" /></Card>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><KV k="Wealth created" v={pct(totals.wealth_created)} tone="up"
              sub="Sum of winning calls" /></Card>
            <Card><KV k="Losses avoided" v={pct(totals.losses_avoided)} tone="up"
              sub="From acting on exits" /></Card>
            <Card><KV k="Capital protected" v={`₹${totals.capital_protected.toLocaleString("en-IN")}`}
              sub="At recommended size" /></Card>
            <Card><KV k="Opportunity cost" v={pct(totals.opportunity_cost)} tone="warn"
              sub="Cost of ignoring right calls" /></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader title="Best call" subtitle="Largest realised gain" icon={TrendingUp} right={null} />
              {totals.best ? (
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={FONT_MONO}>{totals.best.symbol}</span>
                  <Pill tone="neutral" size="xs">{totals.best.action}</Pill>
                  <span className="text-[13px] font-semibold" style={{ color: T.up, ...FONT_MONO }}>
                    {pct(totals.best.absolute_return)}
                  </span>
                </div>
              ) : <div className="text-[12px]" style={{ color: T.fgMute }}>Nothing scored yet</div>}
            </Card>

            <Card>
              <CardHeader title="Worst call" subtitle="Largest realised loss" icon={TrendingDown} right={null} />
              {totals.worst ? (
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={FONT_MONO}>{totals.worst.symbol}</span>
                  <Pill tone="neutral" size="xs">{totals.worst.action}</Pill>
                  <span className="text-[13px] font-semibold" style={{ color: T.down, ...FONT_MONO }}>
                    {pct(totals.worst.absolute_return)}
                  </span>
                </div>
              ) : <div className="text-[12px]" style={{ color: T.fgMute }}>Nothing scored yet</div>}
            </Card>
          </div>

          {Object.keys(data.by_action).length > 0 && (
            <Card padded={false} onClick={undefined} style={undefined}>
              <div className="p-4 pb-0">
                <CardHeader title="Accuracy by call type" subtitle="Which signals are carrying"
                  icon={Activity} right={null} />
              </div>
              {Object.entries(data.by_action).map(([action, stats]) => (
                <Row key={action}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Pill tone={action === "BUY" ? "up" : action === "HOLD" ? "info" : "warn"} size="xs">
                        {action}
                      </Pill>
                      <span className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                        {stats.count} call{stats.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11.5px] font-semibold" style={{ color: T.fg, ...FONT_MONO }}>
                        {pct(stats.accuracy, 0)} accurate
                      </span>
                      <span className="text-[11.5px] font-semibold"
                        style={{ color: stats.average_return >= 0 ? T.up : T.down, ...FONT_MONO }}>
                        {pct(stats.average_return)}
                      </span>
                    </div>
                  </div>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}

      {coverage && (
        <Card>
          <CardHeader title="What the AI is looking at" icon={Activity}
            subtitle={`Valuation provider: ${coverage.provider}`} right={null} />
          <div className="text-[11.5px] leading-relaxed mb-2" style={{ color: T.fg }}>
            Active agents: {coverage.agents.active.join(", ")}
          </div>
          {coverage.agents.pending.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9.5px] uppercase tracking-[0.15em]"
                style={{ color: T.fgDim, ...FONT_MONO }}>
                Not yet contributing
              </div>
              {coverage.agents.pending.map((a) => (
                <div key={a.agent} className="text-[11px] leading-relaxed" style={{ color: T.fgMute }}>
                  <span className="font-semibold" style={{ color: T.fg }}>{a.agent}</span> — {a.needs}
                </div>
              ))}
            </div>
          )}
          <div className="text-[10.5px] mt-3" style={{ color: T.fgDim }}>
            Covered for valuation: {coverage.symbols.join(", ") || "none"}
          </div>
        </Card>
      )}
    </div>
  );
};
