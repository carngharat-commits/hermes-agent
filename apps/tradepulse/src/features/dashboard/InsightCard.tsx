/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { ChevronRight } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";

export const InsightCard = ({ x, setView }: any) => {
  const tones = { up: T.up, down: T.down, warn: T.warn, info: T.info };
  const color = tones[x.tone] || T.info;
  const routeMap = {
    "Review position": "signals",
    "See US positions": "portfolio",
    "See sector": "portfolio",
    "Crypto plan": "risk",
    "MF costs": "risk",
  };
  const handleAction = () => {
    const dest = routeMap[x.action] || "signals";
    setView?.(dest);
  };
  return (
    <div className="p-3.5 rounded-lg flex gap-3" style={{ background: T.card2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}` }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <div className="text-[12.5px] font-semibold leading-tight" style={{ color: T.fg }}>{x.title}</div>
        </div>
        <div className="text-[11px] leading-relaxed" style={{ color: T.fgMute }}>{x.body}</div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30`, ...FONT_MONO }}>
            {x.impact}
          </span>
          <button onClick={handleAction} className="text-[10.5px] font-semibold flex items-center gap-0.5" style={{ color }}>
            {x.action} <ChevronRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
};
