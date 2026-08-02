/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, Globe, LineChart as LineChartIcon, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { ConfidenceRiskDial } from "@/features/signals/ConfidenceRiskDial";
import { FONT_MONO, T } from "@/theme/tokens";
import { MiniStat } from "@/components/ui/MiniStat";
import { Pill } from "@/components/ui/Pill";
import { ReasoningBlock } from "@/features/signals/ReasoningBlock";
import { pct } from "@/lib/format";

export const SignalCard = ({ s, onAskAI, onOpenChart }: any) => {
  const [open, setOpen] = useState(false);
  const isUSStock = s.userPos?.currency === "USD";
  return (
    <Card padded={false} className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold tracking-tight" style={FONT_MONO}>{s.sym}</span>
              <Pill tone={s.action === "HOLD" ? "info" : s.action === "BOOK PART" ? "warn" : "down"} size="sm">{s.action}</Pill>
              <Pill tone="neutral" size="xs">{s.timeframe}</Pill>
              {s.accounts.map(a => (
                <span key={a} className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                  style={{ background: T.subtle2, color: T.fgMute, ...FONT_MONO }}>{a}</span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div>
                <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>LTP</div>
                <div className="text-[13px] font-semibold" style={FONT_MONO}>{isUSStock ? `$${s.ltp.toFixed(2)}` : `₹${s.ltp.toFixed(2)}`}</div>
              </div>
              {s.userPos && (
                <div>
                  <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Your P&L</div>
                  <div className="text-[13px] font-semibold" style={{ color: s.userPos.pl >= 0 ? T.up : T.down, ...FONT_MONO }}>
                    {s.userPos.pl >= 0 ? "+" : "−"}{isUSStock ? `$${Math.abs(s.userPos.pl).toFixed(2)}` : `₹${Math.abs(s.userPos.pl).toLocaleString("en-IN")}`} · {pct(s.userPos.plPct, 1)}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ConfidenceRiskDial confidence={s.confidence} risk={s.riskScore} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <MiniStat label="Entry" v={s.entry ? (isUSStock ? `$${s.entry}` : `₹${s.entry}`) : "—"} />
          <MiniStat label="Target" v={s.target ? (isUSStock ? `$${s.target}` : `₹${s.target}`) : "—"} tone="up" />
          <MiniStat label="Stop" v={s.sl ? (isUSStock ? `$${s.sl}` : `₹${s.sl}`) : "—"} tone="down" />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1">
            {s.tags.map(t => (
              <span key={t} className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: `${T.primary}10`, color: T.primary, border: `1px solid ${T.primary}30`, ...FONT_MONO }}>
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: T.primary }}>
            {open ? "Hide" : "See"} reasoning
            <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <ReasoningBlock label="Technical" icon={LineChartIcon} text={s.reasoning.technical} tone="info" />
          <ReasoningBlock label="Fundamental" icon={BarChart3} text={s.reasoning.fundamental} tone="up" />
          <ReasoningBlock label="Macro / News" icon={Globe} text={s.reasoning.macro} tone="violet" />

          <div className="p-3 rounded-lg" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={12} color={T.warn} />
              <span className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: T.warn, ...FONT_MONO }}>
                What if wrong?
              </span>
            </div>
            <div className="text-[12px] leading-relaxed" style={{ color: T.fg }}>{s.failureScenario}</div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: `${T.primary}10`, border: `1px solid ${T.primary}30` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={12} color={T.primary} />
              <span className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: T.primary, ...FONT_MONO }}>
                Action for you
              </span>
            </div>
            <div className="text-[12px] leading-relaxed" style={{ color: T.fg }}>{s.valueImpact}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenChart?.(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12.5px] font-semibold transition-colors"
              style={{ background: `${T.info}18`, color: T.info, border: `1px solid ${T.info}40` }}>
              <BarChart3 size={13} /> View chart
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAskAI?.(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12.5px] font-semibold transition-colors"
              style={{ background: T.primary, color: T.bg }}>
              <Sparkles size={13} /> Ask AI
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
