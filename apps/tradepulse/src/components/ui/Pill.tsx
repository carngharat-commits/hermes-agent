/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";

export const Pill = ({ children, tone = "neutral", size = "sm" }: any) => {
  const map = {
    up:      { bg: `${T.up}18`,     fg: T.up,     bd: `${T.up}40` },
    down:    { bg: `${T.down}18`,   fg: T.down,   bd: `${T.down}40` },
    warn:    { bg: `${T.warn}18`,   fg: T.warn,   bd: `${T.warn}40` },
    info:    { bg: `${T.info}18`,   fg: T.info,   bd: `${T.info}40` },
    violet:  { bg: `${T.violet}18`, fg: T.violet, bd: `${T.violet}40` },
    neutral: { bg: T.subtle, fg: T.fgMute, bd: T.border },
  }[tone];
  const sz = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded ${sz} font-semibold uppercase tracking-wider`}
      style={{ background: map.bg, color: map.fg, border: `1px solid ${map.bd}`, ...FONT_MONO }}>
      {children}
    </span>
  );
};
