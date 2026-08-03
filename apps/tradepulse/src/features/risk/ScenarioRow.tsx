/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { SegImpact } from "@/features/risk/SegImpact";
import { inrCompact } from "@/lib/format";

export const ScenarioRow = ({ sc, totals }: any) => {
  const [open, setOpen] = useState(false);
  const usL = totals.usCV * (sc.globalUSImpact / 100);
  const mfL = totals.mfCV * (sc.mfImpact / 100);
  const crL = totals.crCV * (sc.cryptoImpact / 100);
  const inL = totals.inCV * (sc.sectorImpacts.Others / 100);
  const total = inL + usL + mfL + crL;
  const c = sc.tone === "down" ? T.down : sc.tone === "warn" ? T.warn : T.info;
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${c}18`, border: `1px solid ${c}40` }}>
          <AlertTriangle size={13} color={c} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{sc.name}</span>
            <Pill tone={sc.weight === "HIGH" ? "down" : "warn"} size="xs">{sc.weight}</Pill>
          </div>
          <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute }}>{sc.desc}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-bold" style={{ color: total >= 0 ? T.up : T.down, ...FONT_MONO }}>
            {total >= 0 ? "+" : "−"}{inrCompact(Math.abs(total))}
          </div>
          <ChevronDown size={12} className="ml-auto" style={{ color: T.fgMute, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>
      {open && (
        <div className="p-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <SegImpact label="IN" v={inL} />
            <SegImpact label="US" v={usL} />
            <SegImpact label="MF" v={mfL} />
            <SegImpact label="CR" v={crL} />
          </div>
          {sc.winners && (
            <div className="mb-2">
              <div className="text-[9.5px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.up, ...FONT_MONO }}>
                Winners in your book
              </div>
              <div className="flex flex-wrap gap-1">
                {sc.winners.map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: `${T.up}18`, color: T.up, border: `1px solid ${T.up}40`, ...FONT_MONO }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {sc.losers && (
            <div>
              <div className="text-[9.5px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.down, ...FONT_MONO }}>
                Losers in your book
              </div>
              <div className="flex flex-wrap gap-1">
                {sc.losers.map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: `${T.down}18`, color: T.down, border: `1px solid ${T.down}40`, ...FONT_MONO }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
