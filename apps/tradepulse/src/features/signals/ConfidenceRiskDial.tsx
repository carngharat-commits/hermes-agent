/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const ConfidenceRiskDial = ({ confidence, risk }: any) => (
  <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-1.5">
      <span className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Conf</span>
      <span className="text-[13px] font-bold" style={{ color: confidence >= 70 ? T.up : confidence >= 50 ? T.warn : T.down, ...FONT_MONO }}>
        {confidence}
      </span>
    </div>
    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: T.subtle }}>
      <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: confidence >= 70 ? T.up : confidence >= 50 ? T.warn : T.down }} />
    </div>
    <div className="flex items-center gap-1.5">
      <span className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Risk</span>
      <span className="text-[13px] font-bold" style={{ color: risk >= 60 ? T.down : risk >= 40 ? T.warn : T.up, ...FONT_MONO }}>
        {risk}
      </span>
    </div>
    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: T.subtle }}>
      <div className="h-full rounded-full" style={{ width: `${risk}%`, background: risk >= 60 ? T.down : risk >= 40 ? T.warn : T.up }} />
    </div>
  </div>
);
