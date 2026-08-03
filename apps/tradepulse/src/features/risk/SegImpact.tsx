/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { inrCompact } from "@/lib/format";

export const SegImpact = ({ label, v }: any) => (
  <div className="p-2 rounded-lg text-center" style={{ background: T.subtle2 }}>
    <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: T.fgDim, ...FONT_MONO }}>{label}</div>
    <div className="text-[11px] font-semibold mt-0.5" style={{ color: v >= 0 ? T.up : T.down, ...FONT_MONO }}>
      {v >= 0 ? "+" : "−"}{inrCompact(Math.abs(v))}
    </div>
  </div>
);
