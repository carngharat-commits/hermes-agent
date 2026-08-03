/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const QuickAction = ({ label, desc, tone, onClick, icon: Ic }: any) => {
  const color = { up: T.up, down: T.down, warn: T.warn, info: T.info, violet: T.violet }[tone] || T.primary;
  return (
    <button onClick={onClick} className="p-3 rounded-lg text-left transition-colors"
      style={{ background: T.card2, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Ic size={12} color={color} />
        </div>
        <div className="text-[12px] font-semibold" style={{ color: T.fg }}>{label}</div>
      </div>
      <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{desc}</div>
    </button>
  );
};
