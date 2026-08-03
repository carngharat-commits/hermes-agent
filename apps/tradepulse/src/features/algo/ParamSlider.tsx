/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const ParamSlider = ({ p, value, onChange }: any) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11.5px] font-semibold" style={{ color: T.fg }}>{p.l}</span>
      <span className="text-[12px] font-bold" style={{ color: T.primary, ...FONT_MONO }}>
        {value}{p.unit && ` ${p.unit}`}
      </span>
    </div>
    <input type="range" min={p.min} max={p.max} step={p.step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full accent-emerald-500 cursor-pointer" />
    <div className="flex items-center justify-between text-[9.5px] mt-0.5" style={{ color: T.fgDim, ...FONT_MONO }}>
      <span>{p.min}</span>
      <span>{p.max}</span>
    </div>
  </div>
);
