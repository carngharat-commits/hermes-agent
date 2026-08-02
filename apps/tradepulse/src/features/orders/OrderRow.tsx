/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";

export const OrderRow = ({ o }: any) => {
  const sideColor = o.side === "BUY" ? T.up : T.down;
  return (
    <Row>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${sideColor}18`, color: sideColor, ...FONT_MONO }}>
              {o.side}
            </span>
            <span className="text-[13.5px] font-bold tracking-tight" style={FONT_MONO}>{o.sym}</span>
            <Pill tone="neutral" size="xs">{o.type}</Pill>
            <span className="text-[10px]" style={{ color: T.fgDim, ...FONT_MONO }}>· {o.broker}</span>
          </div>
          <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>
            {o.qty} × {o.segment === "US" ? "$" : "₹"}{o.price.toFixed(2)} · {o.when}
          </div>
          {o.reason && (
            <div className="text-[10.5px] mt-0.5" style={{ color: T.down, ...FONT_MONO }}>
              ⚠ {o.reason}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <Pill tone={o.status === "EXECUTED" ? "up" : o.status === "PENDING" ? "warn" : "down"} size="sm">{o.status}</Pill>
          <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>{o.id}</div>
        </div>
      </div>
    </Row>
  );
};
