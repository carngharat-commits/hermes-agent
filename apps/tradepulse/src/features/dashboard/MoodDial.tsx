/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const MoodDial = ({ score, label }: any) => {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? T.up : score >= 5 ? T.warn : T.down;
  const circumference = 2 * Math.PI * 42;
  const strokeDash = (pct / 100) * circumference * 0.75; // 3/4 arc
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="42" fill="none" stroke={T.border} strokeWidth="8"
            strokeDasharray={`${circumference * 0.75} ${circumference}`} strokeDashoffset={circumference * 0.125}
            transform="rotate(90 50 50)" strokeLinecap="round" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${strokeDash} ${circumference}`} strokeDashoffset={circumference * 0.125}
            transform="rotate(90 50 50)" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <div className="text-[24px] font-bold" style={{ color, ...FONT_MONO }}>{score.toFixed(1)}</div>
          <div className="text-[9px]" style={{ color: T.fgMute, ...FONT_MONO }}>/ 10</div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold" style={{ color: T.fg }}>{label}</div>
        <div className="text-[10.5px] mt-1" style={{ color: T.fgMute }}>Composite score across sentiment, breadth, flows, technical, volatility</div>
      </div>
    </div>
  );
};
