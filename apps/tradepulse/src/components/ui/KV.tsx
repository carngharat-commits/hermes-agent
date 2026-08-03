/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const KV = ({ k, v, tone = "neutral", sub, mono = true }: any) => (
  <div>
    <div className="text-[9.5px] uppercase tracking-[0.15em]" style={{ color: T.fgMute, ...FONT_MONO }}>{k}</div>
    <div className="text-[14px] font-semibold mt-0.5" style={{
      color: tone === "up" ? T.up : tone === "down" ? T.down : tone === "primary" ? T.primary : T.fg,
      ...(mono ? FONT_MONO : {}),
    }}>{v}</div>
    {sub && <div className="text-[10.5px] mt-0.5" style={{ color: T.fgDim, ...FONT_MONO }}>{sub}</div>}
  </div>
);
