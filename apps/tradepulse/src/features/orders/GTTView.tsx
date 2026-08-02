/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Info } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { GTT_ORDERS } from "@/data/trading";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";

export const GTTView = () => (
  <>
    <div className="p-2.5 rounded-lg flex items-start gap-2 mb-4" style={{ background: `${T.violet}10`, border: `1px solid ${T.violet}30` }}>
      <Info size={13} color={T.violet} className="mt-0.5 shrink-0" />
      <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
        <span className="font-semibold">GTT (Good Till Triggered):</span> Broker-side conditional orders that fire when trigger price hits. Cheaper than keeping stops with your broker daily. Valid 1 year.
      </div>
    </div>

    <Card padded={false}>
      {GTT_ORDERS.map(g => {
        const active = g.status === "ACTIVE";
        return (
          <Row key={g.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${T.down}18`, color: T.down, ...FONT_MONO }}>
                    {g.action}
                  </span>
                  <span className="text-[13.5px] font-bold" style={FONT_MONO}>{g.sym}</span>
                  <span className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>@ ₹{g.trigger}</span>
                  <span className="text-[10.5px]" style={{ color: T.fgDim, ...FONT_MONO }}>· {g.broker}</span>
                </div>
                <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>
                  Qty {g.qty} · Created {g.created}
                </div>
                {g.note && (
                  <div className="text-[10.5px] mt-1 italic" style={{ color: T.fg }}>
                    "{g.note}"
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <Pill tone={active ? "up" : "neutral"} size="sm">{g.status}</Pill>
                <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>{g.id}</div>
              </div>
            </div>
          </Row>
        );
      })}
    </Card>
  </>
);
