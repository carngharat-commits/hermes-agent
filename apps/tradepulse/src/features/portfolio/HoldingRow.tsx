/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";
import { inr, inrCompact, pct, usd } from "@/lib/format";

export const HoldingRow = ({ h, segment }: any) => {
  let displayName, displaySub, priceStr, valueStr, plStr, plPctVal;
  if (segment === "IN") {
    displayName = h.sym;
    displaySub = `${h.qty} · avg ${inr(h.avg, 2)} · ${h.broker}${h.pledged ? " · pledged" : ""}`;
    priceStr = inr(h.ltp, 2);
    valueStr = inrCompact(h.cv);
    plStr = inrCompact(h.pl);
    plPctVal = h.plPct;
  } else if (segment === "US") {
    displayName = h.sym;
    displaySub = h.name;
    priceStr = usd(h.ltp, 2);
    valueStr = usd(h.cv, 2);
    plStr = usd(h.pl, 2);
    plPctVal = h.plPct;
  } else if (segment === "MF") {
    displayName = h.name;
    displaySub = `${h.amc || ""} · ${h.type || ""}${h.type && h.type.includes("Regular") ? " ⚠" : ""}`;
    valueStr = inrCompact(h.cv);
    plStr = inrCompact(h.pl);
    plPctVal = h.plPct;
  } else if (segment === "PM") {
    displayName = h.sym;
    displaySub = `${h.qty} ${h.unit || "g"} · ${h.purity || ""} · ${h.broker}`;
    valueStr = inrCompact(h.cv);
    plStr = inrCompact(h.pl);
    plPctVal = h.plPct;
  } else {
    displayName = h.sym;
    displaySub = `${h.qty.toLocaleString("en-IN", { maximumFractionDigits: 4 })} · ${h.exchange || h.broker}`;
    valueStr = inrCompact(h.cv);
    plStr = inrCompact(h.pl);
    plPctVal = h.plPct;
  }
  const up = h.pl >= 0;
  return (
    <Row>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13.5px] font-bold tracking-tight" style={FONT_MONO}>{displayName}</span>
            {h.pledged && <Pill tone="warn" size="xs">Pledged</Pill>}
            {segment === "US" && h.sym === "SPACEX" && <Pill tone="info" size="xs">Pre-IPO</Pill>}
            {segment === "CR" && h.invested === 0 && <Pill tone="info" size="xs">Airdrop</Pill>}
            {segment === "PM" && <Pill tone="warn" size="xs">Digital</Pill>}
          </div>
          <div className="text-[10.5px] mt-0.5 truncate" style={{ color: T.fgMute }}>{displaySub}</div>
          {priceStr && (
            <div className="text-[10.5px] mt-0.5" style={{ color: T.fgDim, ...FONT_MONO }}>
              LTP {priceStr}{h.dayPct != null && h.dayPct !== 0 && <span style={{ color: h.dayPct >= 0 ? T.up : T.down }}> · {pct(h.dayPct, 2)}</span>}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-semibold" style={FONT_MONO}>{valueStr}</div>
          <div className="text-[11px] font-semibold mt-0.5" style={{ color: up ? T.up : T.down, ...FONT_MONO }}>{plStr}</div>
          <div className="text-[10px] mt-0.5" style={{ color: up ? T.up : T.down, ...FONT_MONO }}>{pct(plPctVal, 2)}</div>
        </div>
      </div>
    </Row>
  );
};
