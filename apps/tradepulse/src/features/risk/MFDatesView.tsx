/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Calendar } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { MF_EXIT_DATA } from "@/data/risk";
import { useBook } from "@/data/book";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";
import { inrCompact } from "@/lib/format";

/* ------ MF Dates + Exit Load Sub-View --------------------------------- */
export const MFDatesView = () => {
  const { MUTUAL_FUNDS } = useBook();
  const [dates, setDates] = useState(() => {
    const init = {};
    MF_EXIT_DATA.forEach(m => { init[m.name] = m.defaultPurchase; });
    return init;
  });
  const today = new Date("2026-07-31");
  const rows = MF_EXIT_DATA.map(m => {
    const p = new Date(dates[m.name]);
    const daysHeld = Math.floor((+today - +p) / (1000 * 60 * 60 * 24));
    const daysUntilFree = Math.max(0, m.lockDays - daysHeld);
    const fund = MUTUAL_FUNDS.find(f => f.name === m.name);
    const exitLoadCost = fund ? fund.current * (m.exitLoadPct / 100) : 0;
    return { ...m, daysHeld, daysUntilFree, exitLoadCost, current: fund?.current };
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="MF Purchase Dates" subtitle="Track exit-load window per fund" icon={Calendar} />
        <div className="text-[11px] leading-relaxed p-2.5 rounded-lg" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30`, color: T.fg }}>
          Exit load applies within lock period (typically 1yr). Adjust purchase date to match your first-lot for accurate calc. For SIPs, each installment has its own clock.
        </div>
      </Card>

      <Card padded={false}>
        {rows.map(r => (
          <Row key={r.name}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{r.name}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="date" value={dates[r.name]}
                    onChange={e => setDates({ ...dates, [r.name]: e.target.value })}
                    className="px-2 py-1 rounded text-[11px] outline-none"
                    style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_MONO }} />
                  <span className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                    Held {r.daysHeld}d · Lock {r.lockDays}d
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {r.daysUntilFree > 0 ? (
                  <>
                    <Pill tone="warn" size="xs">
                      Locked · {r.daysUntilFree}d left
                    </Pill>
                    <div className="text-[11px] font-semibold mt-1" style={{ color: T.down, ...FONT_MONO }}>
                      Exit cost {inrCompact(r.exitLoadCost)}
                    </div>
                  </>
                ) : (
                  <Pill tone="up" size="xs">Free · no exit load</Pill>
                )}
              </div>
            </div>
          </Row>
        ))}
      </Card>
    </div>
  );
};
