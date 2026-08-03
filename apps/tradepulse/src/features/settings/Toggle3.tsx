/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const Toggle3 = ({ value, onChange, options }: any) => (
  <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
    {options.map(o => (
      <button key={o.k} onClick={() => onChange(o.k)}
        className="px-3 py-1.5 rounded-md text-[10.5px] font-semibold"
        style={{
          background: value === o.k ? T.primary : "transparent",
          color: value === o.k ? "#000" : T.fgMute,
          ...FONT_MONO,
        }}>{o.l}</button>
    ))}
  </div>
);
