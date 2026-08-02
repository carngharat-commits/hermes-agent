/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Newspaper, Sparkles } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { MORNING_BRIEF } from "@/data/intelligence";
import { T } from "@/theme/tokens";

export const MorningBriefView = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader title={MORNING_BRIEF.headline} subtitle={MORNING_BRIEF.date} icon={Newspaper} />
      <div className="space-y-3">
        {MORNING_BRIEF.paras.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed" style={{ color: T.fg }}>{p}</p>
        ))}
      </div>
    </Card>

    <Card>
      <CardHeader title="Key Takeaways" subtitle="What matters for your book today" icon={Sparkles} />
      <div className="space-y-2">
        {MORNING_BRIEF.keyTakeaways.map((k, i) => {
          const c = { up:T.up, down:T.down, warn:T.warn, info:T.info }[k.tone] || T.info;
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: T.card2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c}` }}>
              {k.tone === "up" ? <ArrowUpRight size={14} color={c} className="mt-0.5 shrink-0" /> :
               k.tone === "down" ? <ArrowDownRight size={14} color={c} className="mt-0.5 shrink-0" /> :
               <AlertTriangle size={14} color={c} className="mt-0.5 shrink-0" />}
              <span className="text-[12.5px]" style={{ color: T.fg }}>{k.text}</span>
            </div>
          );
        })}
      </div>
    </Card>
  </div>
);
