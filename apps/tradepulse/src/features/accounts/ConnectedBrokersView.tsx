/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { RefreshCw } from "lucide-react";

import { BROKERS_CONNECTED } from "@/data/brokers";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { KiteConnectCard } from "@/features/accounts/KiteConnectCard";
import { Pill } from "@/components/ui/Pill";

export const ConnectedBrokersView = () => (
  <div className="space-y-3">
    <KiteConnectCard />
    {BROKERS_CONNECTED.map(b => {
      const statusColor = b.status === "active" ? T.up : b.status === "read-only" ? T.warn : T.down;
      const isPrimary = b.flag === "primary";
      return (
        <Card key={b.k} style={isPrimary ? { borderColor: T.primary } : undefined}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold"
              style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_MONO }}>
              {b.name.split(" ").map(x => x[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[13.5px] font-semibold">{b.name}</span>
                {isPrimary && <Pill tone="up" size="xs">Primary</Pill>}
                <Pill tone={b.status === "active" ? "up" : b.status === "read-only" ? "warn" : "down"} size="xs">
                  <span style={{ color: statusColor }}>●</span> {b.status}
                </Pill>
              </div>
              <div className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                {b.tier} · {b.holdings} holdings · LTP {b.ltp}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {b.segments.map(s => (
                  <span key={s} className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: T.subtle, color: T.fg, ...FONT_MONO }}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="text-[10.5px] mt-2" style={{ color: T.fgDim, ...FONT_MONO }}>
                Auth: {b.auth} · Last sync: {b.last}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => alert(`Sync triggered for ${b.name}. Fetching latest holdings + LTPs...`)}
                className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold"
                style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}` }}>
                <RefreshCw size={11} className="inline mr-1" /> Sync
              </button>
              <button
                onClick={() => alert(`Disconnect ${b.name}? Stored holdings will be preserved.`)}
                className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold"
                style={{ background: `${T.down}12`, color: T.down, border: `1px solid ${T.down}30` }}>
                Disconnect
              </button>
            </div>
          </div>
        </Card>
      );
    })}
  </div>
);
