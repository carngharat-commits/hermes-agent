/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const MiniStat = ({ label, v, tone = "neutral" }: any) => (
  <div className="p-2 rounded-lg text-center" style={{ background: T.subtle2 }}>
    <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: T.fgDim, ...FONT_MONO }}>{label}</div>
    <div className="text-[11.5px] font-semibold mt-0.5" style={{
      color: tone === "up" ? T.up : tone === "down" ? T.down : T.fg, ...FONT_MONO
    }}>{v}</div>
  </div>
);
