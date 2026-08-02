/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { inrCompact } from "@/lib/format";

export const SegmentTile = ({ label, v, color, onClick }: any) => (
  <button onClick={onClick} className="text-left p-3 rounded-lg transition-colors"
    style={{ background: T.card2, border: `1px solid ${T.border}` }}>
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>{label}</span>
    </div>
    <div className="text-[14.5px] font-bold mt-1.5" style={FONT_MONO}>{inrCompact(v)}</div>
  </button>
);
