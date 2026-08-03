/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { CRYPTO, DIGITAL_METALS, IN_STOCKS, MUTUAL_FUNDS, US_STOCKS } from "@/data/holdings";
import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { MODEL_PORTFOLIOS } from "@/data/risk";
import { Pill } from "@/components/ui/Pill";
import { inrCompact, toINR_us } from "@/lib/format";

/* ------ Rebalance Sub-View -------------------------------------------- */
export const RebalanceView = () => {
  const [modelK, setModelK] = useState("balanced");
  const model = MODEL_PORTFOLIOS.find(m => m.k === modelK);

  const totals = useMemo(() => {
    const inCV = IN_STOCKS.reduce((s, h) => s + h.qty * h.ltp, 0);
    const usCV = US_STOCKS.reduce((s, h) => s + toINR_us(h.qty * h.ltp), 0);
    const mfCV = MUTUAL_FUNDS.reduce((s, h) => s + h.current, 0);
    const crCV = CRYPTO.reduce((s, h) => s + h.current, 0);
    const pmCV = DIGITAL_METALS.reduce((s, h) => s + h.current, 0);
    const cashCV = 96478; // ABML available balance from your statement
    const total = inCV + usCV + mfCV + crCV + pmCV + cashCV;
    return { IN_EQ: inCV, US_EQ: usCV, MF: mfCV, PM: pmCV, CR: crCV, CASH: cashCV, total };
  }, []);

  const rows = [
    { k:"IN_EQ", l:"Indian Eq", c: T.info },
    { k:"US_EQ", l:"US Eq",     c: "#22d3ee" },
    { k:"MF",    l:"MF",        c: T.violet },
    { k:"PM",    l:"Metals",    c: "#fbbf24" },
    { k:"CR",    l:"Crypto",    c: T.warn },
    { k:"CASH",  l:"Cash",      c: T.up },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Rebalance" subtitle="Compare your allocation to model targets" icon={RefreshCw} />
        <div className="grid grid-cols-3 gap-2">
          {MODEL_PORTFOLIOS.map(m => (
            <button key={m.k} onClick={() => setModelK(m.k)}
              className="p-3 rounded-lg text-left transition-colors"
              style={{
                background: modelK === m.k ? `${T.primary}18` : T.card2,
                border: `1px solid ${modelK === m.k ? T.primary : T.border}`,
              }}>
              <div className="text-[12.5px] font-semibold" style={{ color: modelK === m.k ? T.primary : T.fg }}>{m.name}</div>
              <Pill tone={m.risk === "LOW" ? "up" : m.risk === "MED" ? "warn" : "down"} size="xs">{m.risk}</Pill>
            </button>
          ))}
        </div>
        <div className="text-[11.5px] mt-3 p-2.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fgMute }}>
          {model.desc}
        </div>
      </Card>

      <Card>
        <CardHeader title={`${model.name} portfolio · drift analysis`} />
        <div className="space-y-3">
          {rows.map(r => {
            const cur = ((totals[r.k] || 0) / totals.total) * 100;
            const tgt = model.targets[r.k] || 0;
            const drift = cur - tgt;
            const trade = totals.total * (drift / 100);
            return (
              <div key={r.k}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold" style={{ color: T.fg }}>{r.l}</span>
                  <div className="flex items-center gap-3 text-[11px]" style={FONT_MONO}>
                    <span style={{ color: T.fgMute }}>Cur {cur.toFixed(1)}%</span>
                    <span style={{ color: T.fgMute }}>Tgt {tgt}%</span>
                    <span style={{ color: Math.abs(drift) < 2 ? T.up : drift > 0 ? T.warn : T.down }}>
                      {drift >= 0 ? "+" : "−"}{Math.abs(drift).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: T.subtle2 }}>
                  <div className="h-full absolute" style={{ width: `${Math.min(100, cur)}%`, background: r.c, opacity: 0.7 }} />
                  <div className="w-0.5 h-full absolute" style={{ left: `${Math.min(100, tgt)}%`, background: T.fg }} />
                </div>
                {Math.abs(drift) >= 2 && (
                  <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>
                    {drift > 0 ? "Sell " : "Buy "}
                    <span style={{ color: drift > 0 ? T.warn : T.up, fontWeight: 600 }}>
                      {inrCompact(Math.abs(trade))}
                    </span> {drift > 0 ? "from" : "in"} {r.l}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
