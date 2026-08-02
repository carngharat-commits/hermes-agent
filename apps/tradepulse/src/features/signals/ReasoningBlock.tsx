/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const ReasoningBlock = ({ label, icon: Ic, text, tone }: any) => {
  const c = { up:T.up, info:T.info, violet:T.violet }[tone] || T.fg;
  return (
    <div className="pt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Ic size={12} color={c} />
        <span className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: c, ...FONT_MONO }}>
          {label}
        </span>
      </div>
      <div className="text-[12px] leading-relaxed" style={{ color: T.fg }}>{text}</div>
    </div>
  );
};
