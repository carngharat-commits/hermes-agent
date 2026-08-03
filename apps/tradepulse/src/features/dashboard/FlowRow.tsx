/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const FlowRow = ({ label, data, tone }: any) => {
  const color = tone === "up" ? T.up : T.down;
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>{label}</div>
          <div className="text-[10.5px] mt-0.5" style={{ color: T.fgDim, ...FONT_MONO }}>Trend · {data.trend}</div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold" style={{ color, ...FONT_MONO }}>
            {data.session >= 0 ? "+" : ""}₹{data.session.toLocaleString("en-IN")} Cr
          </div>
          <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
            5-day: {data.last5 >= 0 ? "+" : ""}₹{data.last5.toLocaleString("en-IN")} Cr
          </div>
        </div>
      </div>
    </div>
  );
};
