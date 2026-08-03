/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Globe, MoreHorizontal } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { inrCompact } from "@/lib/format";

export const GeopolEventCard = ({ e }: any) => {
  const [open, setOpen] = useState(e.weight === "HIGH");
  const regionColor = { US:T.info, India:T.warn, China:T.down, Global:T.violet }[e.region] || T.fgMute;
  return (
    <Card padded={false} className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${regionColor}18`, border: `1px solid ${regionColor}40` }}>
            <Globe size={15} color={regionColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Pill tone={e.tone === "up" ? "up" : e.tone === "down" ? "down" : "warn"} size="xs">{e.region}</Pill>
              <Pill tone={e.weight === "HIGH" ? "down" : e.weight === "MED" ? "warn" : "neutral"} size="xs">{e.weight}</Pill>
              <span className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{e.date}</span>
            </div>
            <div className="text-[13.5px] font-semibold leading-tight">{e.title}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[13px] font-semibold" style={{ color: e.total >= 0 ? T.up : T.down, ...FONT_MONO }}>
              {e.total >= 0 ? "+" : "−"}{inrCompact(Math.abs(e.total))}
            </div>
            <ChevronDown size={13} color={T.fgMute} className="ml-auto mt-1"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <p className="text-[12px] leading-relaxed mt-3" style={{ color: T.fgMute }}>{e.body}</p>

          <div className="text-[10.5px] uppercase tracking-[0.15em] font-semibold mt-4 mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
            Impact on your holdings
          </div>
          <div className="space-y-1.5">
            {e.impacts.map((im, i) => {
              const c = im.direction === "up" ? T.up : im.direction === "down" ? T.down : T.fgMute;
              return (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
                  <div className="w-8 shrink-0">
                    {im.direction === "up" ? <ArrowUpRight size={13} color={c} /> :
                     im.direction === "down" ? <ArrowDownRight size={13} color={c} /> :
                     <MoreHorizontal size={13} color={c} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold" style={{ color: T.fg, ...FONT_MONO }}>{im.asset}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.fgMute }}>{im.note}</div>
                  </div>
                  {im.value !== 0 && im.value != null && (
                    <div className="text-[11.5px] font-semibold shrink-0" style={{ color: c, ...FONT_MONO }}>
                      {im.value >= 0 ? "+" : "−"}₹{Math.abs(im.value).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
