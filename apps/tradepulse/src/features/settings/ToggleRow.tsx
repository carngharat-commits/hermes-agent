/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const ToggleRow = ({ label, sub, value, onChange }: any) => (
  <div className="flex items-start justify-between gap-3 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
    <div className="flex-1 min-w-0">
      <div className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{label}</div>
      {sub && <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute }}>{sub}</div>}
    </div>
    <button onClick={() => onChange(!value)}
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={{ background: value ? T.primary : T.card2, border: `1px solid ${value ? T.primary : T.border}` }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
        style={{
          background: value ? "#000" : T.fgMute,
          transform: value ? "translateX(18px)" : "translateX(2px)",
        }} />
    </button>
  </div>
);
