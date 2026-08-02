/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Bitcoin, Calendar, GitCompare, Percent, RefreshCw, ShieldAlert } from "lucide-react";

import { BetaStressView } from "@/features/risk/BetaStressView";
import { CorrelationView } from "@/features/risk/CorrelationView";
import { CryptoPlanView } from "@/features/risk/CryptoPlanView";
import { MFDatesView } from "@/features/risk/MFDatesView";
import { RebalanceView } from "@/features/risk/RebalanceView";
import { T } from "@/theme/tokens";
import { TaxHarvestView } from "@/features/risk/TaxHarvestView";

export const RiskAuditTab = () => {
  const [tab, setTab] = useState("beta"); // beta | tax | rebalance | correlation | crypto | mfdates
  const tabs = [
    { k:"beta",        l:"Beta & Stress",  ic:ShieldAlert },
    { k:"tax",         l:"Tax Harvest",    ic:Percent },
    { k:"rebalance",   l:"Rebalance",      ic:RefreshCw },
    { k:"correlation", l:"Correlation",    ic:GitCompare },
    { k:"crypto",      l:"Crypto Plan",    ic:Bitcoin },
    { k:"mfdates",     l:"MF Dates",       ic:Calendar },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert size={20} color={T.primary} /> Risk Audit
          </h1>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            Portfolio risk metrics + advisory modules folded in
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map(t => {
          const Ic = t.ic;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
              style={{
                background: active ? `${T.primary}18` : T.card2,
                color: active ? T.primary : T.fg,
                border: `1px solid ${active ? `${T.primary}40` : T.border}`,
              }}>
              <Ic size={13} />
              <span className="text-[11.5px] font-semibold">{t.l}</span>
            </button>
          );
        })}
      </div>

      {tab === "beta"        && <BetaStressView />}
      {tab === "tax"         && <TaxHarvestView />}
      {tab === "rebalance"   && <RebalanceView />}
      {tab === "correlation" && <CorrelationView />}
      {tab === "crypto"      && <CryptoPlanView />}
      {tab === "mfdates"     && <MFDatesView />}
    </div>
  );
};
