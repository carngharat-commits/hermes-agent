/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const SettingRow = ({ label, sub, children }: any) => (
  <div className="flex items-start justify-between gap-3 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
    <div className="flex-1 min-w-0">
      <div className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{label}</div>
      {sub && <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute }}>{sub}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);
