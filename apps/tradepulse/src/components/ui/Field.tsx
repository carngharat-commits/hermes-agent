/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const Label = ({ children }: any) => (
  <div className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>{children}</div>
);

export const Input = ({ value, onChange, placeholder, numeric, upper }: any) => (
  <input value={value}
    onChange={e => {
      let v = e.target.value;
      if (upper) v = v.toUpperCase();
      if (numeric) v = v.replace(/[^0-9.]/g, "");
      onChange(v);
    }}
    placeholder={placeholder}
    inputMode={numeric ? "decimal" : "text"}
    className="w-full mt-1.5 px-3 py-2.5 rounded-lg text-[13px] outline-none"
    style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_MONO }} />
);
