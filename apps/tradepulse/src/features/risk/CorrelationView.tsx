/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { GitCompare } from "lucide-react";

import { CORR } from "@/data/risk";
import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";

/* ------ Correlation Sub-View ------------------------------------------ */
export const CorrelationView = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader title="Asset-Class Correlation Matrix" subtitle="Higher correlation → less diversification benefit" icon={GitCompare} />
      <div className="overflow-x-auto">
        <table className="text-[11px]" style={FONT_MONO}>
          <thead>
            <tr>
              <th></th>
              {CORR.labels.map(l => (
                <th key={l} className="px-2 py-1.5 font-semibold" style={{ color: T.fgMute, minWidth: 60 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CORR.matrix.map((row, i) => (
              <tr key={i}>
                <td className="pr-2 py-1.5 font-semibold text-right" style={{ color: T.fgMute }}>{CORR.labels[i]}</td>
                {row.map((v, j) => {
                  const abs = Math.abs(v);
                  const bg = i === j ? T.card2 : v > 0 ? `rgba(239, 68, 68, ${abs * 0.35})` : `rgba(16, 185, 129, ${abs * 0.35})`;
                  return (
                    <td key={j} className="text-center px-2 py-1.5 rounded font-semibold"
                      style={{ background: bg, color: i === j ? T.fgMute : T.fg }}>
                      {v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-2 text-[11.5px]" style={{ color: T.fg }}>
        <div><span className="font-semibold" style={{ color: T.down }}>IN Eq ↔ MF (0.86):</span> {'>'}75% overlap — MF adds limited diversification to your Indian equity.</div>
        <div><span className="font-semibold" style={{ color: T.up }}>US Eq ↔ INR (−0.68):</span> Strong negative — US book is your natural INR hedge.</div>
        <div><span className="font-semibold" style={{ color: T.info }}>Crypto ↔ US Eq (0.51):</span> Moderate coupling — crypto not a pure hedge to US book.</div>
      </div>
    </Card>
  </div>
);
