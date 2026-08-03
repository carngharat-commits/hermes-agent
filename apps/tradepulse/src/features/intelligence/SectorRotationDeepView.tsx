/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { GitCompare } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { SectorTargetTable } from "@/features/intelligence/SectorTargetTable";

export const SectorRotationDeepView = () => {
  const phases = [
    { k:"Early Expansion", desc:"Recovery from trough. Favor cyclicals, financials, industrials.", active:false },
    { k:"Mid Cycle",       desc:"Growth acceleration. IT, discretionary, momentum.",              active:false },
    { k:"Late Cycle",      desc:"Peak growth. Defensives, staples, utilities, pharma.",           active:true },
    { k:"Recession",       desc:"Contraction. Bonds, gold, defensives dominant.",                 active:false },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Economic Cycle Phase" subtitle="Aligned with market mood + macro indicators" icon={GitCompare} />
        <div className="grid grid-cols-4 gap-2">
          {phases.map(p => (
            <div key={p.k} className="p-3 rounded-lg text-center"
              style={{
                background: p.active ? `${T.warn}18` : T.card2,
                border: `1px solid ${p.active ? T.warn : T.border}`,
              }}>
              <div className="text-[10.5px] font-semibold" style={{ color: p.active ? T.warn : T.fgMute }}>{p.k}</div>
              {p.active && <div className="text-[9px] mt-1" style={{ color: T.warn, ...FONT_MONO }}>● CURRENT</div>}
            </div>
          ))}
        </div>
        <div className="text-[11.5px] mt-3 p-3 rounded-lg" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30`, color: T.fg }}>
          <span className="font-semibold" style={{ color: T.warn }}>Late Cycle · </span>
          Peak growth reached. Rotate into defensives (Consumer, Utilities, Pharma). Trim high-beta / cyclicals (Auto, Metals, Infra). Your book is over-weighted Cyclicals — consider rebalancing.
        </div>
      </Card>

      <Card>
        <CardHeader title="Recommended Positioning · Late Cycle" subtitle="vs your current sector weights" />
        <SectorTargetTable />
      </Card>
    </div>
  );
};
