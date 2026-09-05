/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { AlertTriangle, Bitcoin } from "lucide-react";

import { useBook } from "@/data/book";
import { CRYPTO_PLAN } from "@/data/risk";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { inrCompact } from "@/lib/format";

/* ------ Crypto Plan Sub-View ------------------------------------------ */
export const CryptoPlanView = () => {
  const { CRYPTO } = useBook();
  const totalCurrent = CRYPTO.reduce((s, c) => s + c.current, 0);
  const totalInvested = CRYPTO.reduce((s, c) => s + c.invested, 0);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30` }}>
          <AlertTriangle size={16} color={T.warn} className="shrink-0" />
          <div className="text-[11.5px]" style={{ color: T.fg }}>
            <span className="font-semibold">Section 115BBH:</span> Crypto (VDA) gains taxed at 30% flat.
            Losses <span className="font-semibold">cannot</span> offset gains from other VDAs or asset classes.
            Booking losses only frees capital, not tax offset.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <KV k="Current" v={inrCompact(totalCurrent)} />
          <KV k="Invested" v={inrCompact(totalInvested)} />
          <KV k="P&L" v={inrCompact(totalCurrent - totalInvested)} tone={totalCurrent >= totalInvested ? "up" : "down"} />
        </div>
      </Card>

      <div className="space-y-3">
        {CRYPTO_PLAN.map(p => {
          const pos = CRYPTO.find(c => c.sym === p.sym);
          const verdictColor = { HOLD:T.info, EXIT:T.down, IGNORE:T.fgMute, TRIM:T.warn, BUY:T.up }[p.verdict] || T.fg;
          return (
            <Card key={p.sym}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${verdictColor}18`, border: `1px solid ${verdictColor}40` }}>
                  <Bitcoin size={16} color={verdictColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13.5px] font-bold" style={FONT_MONO}>{p.sym}</span>
                    <span className="text-[11px]" style={{ color: T.fgMute }}>· {p.name}</span>
                    <Pill tone={p.verdict === "HOLD" ? "info" : p.verdict === "EXIT" ? "down" : p.verdict === "IGNORE" ? "neutral" : "warn"} size="xs">
                      {p.verdict}
                    </Pill>
                    <span className="text-[10px] font-semibold" style={{ color: verdictColor, ...FONT_MONO }}>
                      Conf {p.confidence}
                    </span>
                  </div>
                  {pos && (
                    <div className="text-[10.5px] mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
                      {pos.qty.toLocaleString("en-IN", { maximumFractionDigits: 4 })} · {inrCompact(pos.current)} · P&L{" "}
                      <span style={{ color: pos.current >= pos.invested ? T.up : T.down }}>
                        {inrCompact(pos.current - pos.invested)}
                      </span>
                    </div>
                  )}
                  <div className="text-[11.5px] leading-relaxed" style={{ color: T.fg }}>{p.reason}</div>
                  <div className="mt-2 p-2 rounded" style={{ background: T.card2, borderLeft: `2px solid ${verdictColor}` }}>
                    <div className="text-[9.5px] uppercase tracking-widest font-semibold mb-1" style={{ color: verdictColor, ...FONT_MONO }}>
                      Action
                    </div>
                    <div className="text-[11.5px]" style={{ color: T.fg }}>{p.action}</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
