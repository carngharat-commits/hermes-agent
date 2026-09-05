/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { Check, Percent } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { useBook } from "@/data/book";
import { KV } from "@/components/ui/KV";
import { inrCompact, pct } from "@/lib/format";

/* ------ Tax Harvest Sub-View ------------------------------------------ */
export const TaxHarvestView = () => {
  const { IN_STOCKS } = useBook();
  const [selected, setSelected] = useState({});
  const losers = useMemo(() => {
    // Compute loss for each holding with avg present
    const rows = IN_STOCKS.filter(h => h.avg && h.qty * (h.ltp - h.avg) < 0)
      .map(h => ({
        sym: h.sym, broker: h.broker, qty: h.qty, avg: h.avg, ltp: h.ltp,
        loss: h.qty * (h.ltp - h.avg),
        pct: ((h.ltp - h.avg) / h.avg) * 100,
      }))
      .sort((a, b) => a.loss - b.loss);
    return rows;
  }, []);

  const toggle = (key) => setSelected(prev => ({ ...prev, [key]: !prev[key] }));

  const totalLoss = losers.reduce((s, r) => s + (selected[r.sym + r.broker] ? Math.abs(r.loss) : 0), 0);
  const taxSaveLTCG = totalLoss * 0.125; // 12.5% LTCG
  const taxSaveSTCG = totalLoss * 0.20;  // 20% STCG (short-term ≤ 1yr)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Tax-Loss Harvesting" subtitle="Book losses to offset realized gains this FY" icon={Percent} />
        <div className="grid grid-cols-3 gap-3">
          <KV k="Selected loss" v={inrCompact(totalLoss)} tone="down" />
          <KV k="LTCG offset (12.5%)" v={inrCompact(taxSaveLTCG)} tone="up" />
          <KV k="STCG offset (20%)" v={inrCompact(taxSaveSTCG)} tone="up" />
        </div>
        <div className="mt-3 p-2.5 rounded-lg text-[11px]" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30`, color: T.fg }}>
          <span className="font-semibold">Note:</span> LTCG has ₹1.25L annual exemption. Holdings sold below 1yr fall under STCG at 20%. Consult tax advisor before execution.
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold">Harvest candidates · {losers.length} positions</span>
            <button
              onClick={() => {
                const all = {};
                losers.slice(0, 5).forEach(r => { all[r.sym + r.broker] = true; });
                setSelected(all);
              }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: `${T.primary}18`, color: T.primary, border: `1px solid ${T.primary}40` }}>
              Select top 5 losers
            </button>
          </div>
        </div>
        {losers.map(r => {
          const key = r.sym + r.broker;
          const on = !!selected[key];
          return (
            <button key={key} onClick={() => toggle(key)}
              className="w-full text-left p-3.5 flex items-center gap-3"
              style={{ background: on ? `${T.down}08` : "transparent", borderBottom: `1px solid ${T.border}` }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: on ? T.down : "transparent", border: `1px solid ${on ? T.down : T.border}` }}>
                {on && <Check size={12} color="#fff" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={FONT_MONO}>{r.sym}</span>
                  <span className="text-[10px]" style={{ color: T.fgMute, ...FONT_MONO }}>· {r.broker}</span>
                </div>
                <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute, ...FONT_MONO }}>
                  {r.qty} × avg ₹{r.avg.toFixed(2)} · LTP ₹{r.ltp.toFixed(2)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12.5px] font-semibold" style={{ color: T.down, ...FONT_MONO }}>
                  {inrCompact(r.loss)}
                </div>
                <div className="text-[10.5px]" style={{ color: T.down, ...FONT_MONO }}>{pct(r.pct, 1)}</div>
              </div>
            </button>
          );
        })}
      </Card>
    </div>
  );
};
