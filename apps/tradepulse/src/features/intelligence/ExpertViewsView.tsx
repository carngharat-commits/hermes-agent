/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Info } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { EXPERT_VIEWS } from "@/data/intelligence";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";

export const ExpertViewsView = () => (
  <div className="space-y-3">
    <Card>
      <div className="flex items-center gap-2 flex-wrap">
        <Info size={13} color={T.warn} />
        <span className="text-[12px] font-semibold">Illustrative analyst quotes</span>
        <DemoBadge note="Analyst names and firms (Chris Wood / Jefferies, Ridham Desai / Morgan Stanley, Kunal Vora / Nomura, Sanjeev Prasad / Kotak, Jim Reid / Goldman Sachs, Neelkanth Mishra / Axis Capital) are real market analysts at their respective firms. However, the specific quotes, dates, and stances shown are fabricated illustrations of the kind of views these analysts typically publish — NOT actual verbatim quotes. In production, this feed would come from a licensed analyst source (Bloomberg Terminal, Refinitiv, Smartkarma, or direct broker research portal access) with real dated notes." />
      </div>
      <div className="text-[11px] mt-1.5" style={{ color: T.fgMute }}>
        Names + firms are real analysts. The specific quotes below are illustrative for demo purposes only.
      </div>
    </Card>

    {EXPERT_VIEWS.map(v => {
      const stanceColor = v.stance === "bullish" ? T.up : v.stance === "bearish" ? T.down : v.stance === "cautious" ? T.warn : T.fgMute;
      return (
        <Card key={v.id}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: `${stanceColor}18`, color: stanceColor, border: `1px solid ${stanceColor}40` }}>
              {v.analyst.split(" ").map(x => x[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[12.5px] font-semibold">{v.analyst}</span>
                <span className="text-[11px]" style={{ color: T.fgMute }}>· {v.firm}</span>
                <Pill tone={v.stance === "bullish" ? "up" : v.stance === "bearish" ? "down" : "warn"} size="xs">
                  {v.stance.toUpperCase()}
                </Pill>
                <span className="text-[10.5px]" style={{ color: T.fgDim, ...FONT_MONO }}>{v.date}</span>
              </div>
              <div className="text-[13px] font-semibold leading-tight mb-1.5" style={{ color: T.fg }}>{v.title}</div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: T.fgMute }}>{v.body}</p>
              {v.yourExposure && v.yourExposure.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9.5px] uppercase tracking-[0.15em] font-semibold mb-1.5" style={{ color: T.fgMute, ...FONT_MONO }}>
                    Names you own affected
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.yourExposure.slice(0, 8).map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: `${T.info}18`, color: T.info, border: `1px solid ${T.info}30`, ...FONT_MONO }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      );
    })}
  </div>
);
