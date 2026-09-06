/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useMemo } from "react";
import { AlertTriangle, Globe, ShieldAlert } from "lucide-react";

import { BetaDial } from "@/features/risk/BetaDial";
import { useBook } from "@/data/book";
import { Card, CardHeader } from "@/components/ui/Card";
import { KV } from "@/components/ui/KV";
import { SECTOR } from "@/data/taxonomy";
import { SECTOR_BETA, STRESS_SCENARIOS } from "@/data/risk";
import { ScenarioRow } from "@/features/risk/ScenarioRow";
import { StressTable } from "@/features/risk/StressTable";
import { T } from "@/theme/tokens";
import { inrCompact, toINR_us } from "@/lib/format";

/* ------ Beta & Stress Sub-View --------------------------------------- */
export const BetaStressView = () => {
  const { CRYPTO, IN_STOCKS, MUTUAL_FUNDS, US_STOCKS } = useBook();
  const inH = IN_STOCKS;
  const totals = useMemo(() => {
    const inCV = inH.reduce((s, h) => s + h.qty * h.ltp, 0);
    const usCV = US_STOCKS.reduce((s, h) => s + toINR_us(h.qty * h.ltp), 0);
    const mfCV = MUTUAL_FUNDS.reduce((s, h) => s + h.current, 0);
    const crCV = CRYPTO.reduce((s, h) => s + h.current, 0);
    const total = inCV + usCV + mfCV + crCV;

    // Weighted beta from sector exposures
    let weightedBeta = 0;
    inH.forEach(h => {
      const s = SECTOR[h.sym] || "Others";
      const b = SECTOR_BETA[s] || 1.0;
      weightedBeta += (h.qty * h.ltp / inCV) * b;
    });
    // Blend across segments (US ~0.85 to Nifty, MF ~0.95, Crypto ~2.0)
    const blendedBeta =
      (weightedBeta * inCV + 0.85 * usCV + 0.95 * mfCV + 2.0 * crCV) / total;

    return { inCV, usCV, mfCV, crCV, total, blendedBeta };
  }, [inH, US_STOCKS, MUTUAL_FUNDS, CRYPTO]);  // the book changes at runtime now

  const beta = totals.blendedBeta;
  const interp = beta < 0.7 ? "Defensive · lower volatility than market"
              : beta < 1.05 ? "Market Neutral · moves in line with Nifty"
              : beta < 1.30 ? "Slightly Aggressive · outperforms in bull, underperforms in bear"
              : "High Volatility · significantly more volatile than Nifty";

  return (
    <div className="space-y-4">
      {/* Beta Dial */}
      <Card>
        <CardHeader title="Portfolio Beta" subtitle="Sector-weighted, blended across segments" icon={ShieldAlert} />
        <div className="flex items-center gap-5 flex-wrap">
          <BetaDial value={beta} />
          <div className="flex-1 min-w-[220px]">
            <div className="text-[13px] font-semibold mb-2" style={{ color: T.fg }}>{interp}</div>
            <div className="grid grid-cols-2 gap-3">
              <KV k="IN Eq (₹)" v={inrCompact(totals.inCV)} sub={`β≈${(totals.blendedBeta * 0.9).toFixed(2)}`} />
              <KV k="US Eq (₹)" v={inrCompact(totals.usCV)} sub="β≈0.85" />
              <KV k="MF (₹)"    v={inrCompact(totals.mfCV)} sub="β≈0.95" />
              <KV k="Crypto (₹)" v={inrCompact(totals.crCV)} sub="β≈2.00" />
            </div>
          </div>
        </div>
      </Card>

      {/* Nifty -10% Stress */}
      <Card>
        <CardHeader title="Nifty −10% stress test" subtitle="Segment-by-segment impact" icon={AlertTriangle} />
        <StressTable scenario={STRESS_SCENARIOS[0]} totals={totals} />
      </Card>

      {/* Geopolitical Scenarios */}
      <Card>
        <CardHeader title="Geopolitical Scenarios" subtitle={`${STRESS_SCENARIOS.length - 1} scenarios modelled`} icon={Globe} />
        <div className="space-y-2">
          {STRESS_SCENARIOS.slice(1).map(sc => <ScenarioRow key={sc.id} sc={sc} totals={totals} />)}
        </div>
      </Card>
    </div>
  );
};
