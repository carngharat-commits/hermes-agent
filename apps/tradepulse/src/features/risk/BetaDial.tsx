/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const BetaDial = ({ value }: any) => {
  const min = 0, max = 2;
  const clamped = Math.min(max, Math.max(min, value));
  const pct = (clamped / max) * 100;
  const color = value < 0.7 ? T.up : value < 1.05 ? T.info : value < 1.30 ? T.warn : T.down;
  const circumference = 2 * Math.PI * 42;
  const strokeDash = (pct / 100) * circumference * 0.75;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="42" fill="none" stroke={T.border} strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference}`} strokeDashoffset={circumference * 0.125}
          transform="rotate(90 50 50)" strokeLinecap="round" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circumference}`} strokeDashoffset={circumference * 0.125}
          transform="rotate(90 50 50)" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <div className="text-[26px] font-bold" style={{ color, ...FONT_MONO }}>{value.toFixed(2)}</div>
        <div className="text-[9px]" style={{ color: T.fgMute, ...FONT_MONO }}>β · portfolio</div>
      </div>
    </div>
  );
};
