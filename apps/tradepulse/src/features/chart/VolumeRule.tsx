/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const VolumeRule = ({ tone, label, text }: any) => {
  const c = { up: T.up, down: T.down, warn: T.warn, info: T.info }[tone];
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c}` }}>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold" style={{ color: c, ...FONT_MONO }}>{label}</div>
        <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: T.fg }}>{text}</div>
      </div>
    </div>
  );
};
