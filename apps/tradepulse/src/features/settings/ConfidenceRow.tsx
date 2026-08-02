/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const ConfidenceRow = ({ tone, pct, label, note }: any) => {
  const c = { up: T.up, warn: T.warn, down: T.down }[tone] || T.fgMute;
  const pctNum = parseInt(pct);
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="text-[12.5px] font-bold shrink-0 w-11 text-right" style={{ color: c, ...FONT_MONO }}>{pct}</div>
      <div className="w-16 h-1 rounded-full overflow-hidden mt-2 shrink-0" style={{ background: T.subtle }}>
        <div className="h-full rounded-full" style={{ width: `${pctNum}%`, background: c }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold" style={{ color: T.fg }}>{label}</div>
        <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute }}>{note}</div>
      </div>
    </div>
  );
};
