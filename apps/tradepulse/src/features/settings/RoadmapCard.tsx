/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Check, ChevronDown, Sparkles, Zap } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { ROADMAP } from "@/data/roadmap";

export const RoadmapCard = () => {
  const [open, setOpen] = useState(null); // null | step number
  const totalWeeks = "22-40 weeks (5-9 months)";
  const totalCost = "~₹15K-40K/mo running + ₹1L one-time";
  return (
    <Card>
      <CardHeader title="Roadmap to Production" subtitle="Step-by-step to go from demo to real trading intelligence" icon={Zap}
        right={<Pill tone="info">{ROADMAP.length} steps</Pill>} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <KV k="Total build time" v={totalWeeks} tone="info" mono={false} />
        <KV k="Running cost" v={totalCost} tone="warn" mono={false} />
      </div>

      <div className="space-y-2">
        {ROADMAP.map(r => {
          const active = open === r.step;
          return (
            <div key={r.step} className="rounded-lg overflow-hidden"
              style={{ background: T.card2, border: `1px solid ${active ? T.primary : T.border}` }}>
              <button onClick={() => setOpen(active ? null : r.step)} className="w-full text-left p-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                  style={{ background: active ? T.primary : T.subtle, color: active ? T.bg : T.fg, ...FONT_MONO }}>
                  {r.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{r.title}</span>
                    <Pill tone="neutral" size="xs">{r.weeks}</Pill>
                    <Pill tone="warn" size="xs">{r.cost}</Pill>
                    {r.shipped?.length > 0 && (
                      <Pill tone="up" size="xs">{r.shipped.length} shipped</Pill>
                    )}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: T.fgMute }}>{r.goal}</div>
                </div>
                <ChevronDown size={13} color={T.fgMute} className="shrink-0 mt-1"
                  style={{ transform: active ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              {active && (
                <div className="px-3 pb-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  {r.shipped?.length > 0 && (
                    <>
                      <div className="text-[10.5px] uppercase tracking-widest font-semibold mt-2 mb-2" style={{ color: T.primary, ...FONT_MONO }}>
                        Shipped
                      </div>
                      <ul className="space-y-1.5 mb-3">
                        {r.shipped.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                            <Check size={12} color={T.primary} className="mt-0.5 shrink-0" />
                            <span style={{ color: T.fg }}>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="text-[10.5px] uppercase tracking-widest font-semibold mt-2 mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
                    Concrete todos
                  </div>
                  <ul className="space-y-1.5">
                    {r.todos.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                        <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: T.primary }} />
                        <span style={{ color: T.fg }}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ background: `${T.primary}10`, border: `1px solid ${T.primary}30` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={12} color={T.primary} />
          <span className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: T.primary, ...FONT_MONO }}>
            Suggested order
          </span>
        </div>
        <div className="text-[11.5px] leading-relaxed" style={{ color: T.fg }}>
          <span className="font-semibold">Weeks 1-6:</span> Steps 1 + 2 (broker + market data) — gets your real portfolio live. <br />
          <span className="font-semibold">Weeks 7-10:</span> Step 5 (investor tracking, cheap + high value). <br />
          <span className="font-semibold">Weeks 11-16:</span> Steps 3 + 4 (news + signals). <br />
          <span className="font-semibold">Weeks 17+:</span> Step 6 (backend) once you have real data flowing. Step 7 (compliance) only if sharing with others.
        </div>
      </div>
    </Card>
  );
};
