/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { ChevronRight, Info } from "lucide-react";

import { BROKERS_AVAILABLE } from "@/data/brokers";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";

export const AvailableBrokersView = () => (
  <div className="space-y-3">
    <div className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: `${T.info}10`, border: `1px solid ${T.info}30` }}>
      <Info size={13} color={T.info} className="mt-0.5 shrink-0" />
      <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
        Connecting a broker enables live holdings sync + LTP + order book mirror. TradePulse never routes orders — execution stays in your broker app.
      </div>
    </div>

    {BROKERS_AVAILABLE.map(b => {
      const isFree = b.tier.toUpperCase().includes("FREE");
      return (
        <Card key={b.k}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold"
              style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fgMute, ...FONT_MONO }}>
              {b.name.split(" ").map(x => x[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[13.5px] font-semibold">{b.name}</span>
                <Pill tone={isFree ? "up" : "warn"} size="xs">{b.tier}</Pill>
              </div>
              <div className="text-[11.5px] leading-relaxed" style={{ color: T.fgMute }}>{b.note}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {b.segments.map(s => (
                  <span key={s} className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: T.subtle, color: T.fg, ...FONT_MONO }}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="text-[10.5px] mt-2" style={{ color: T.fgDim, ...FONT_MONO }}>
                Auth: {b.auth}
              </div>
            </div>
            <button
              onClick={() => alert(`Connect ${b.name}\n\nStep 1: You'll be redirected to ${b.name} to authorize.\nStep 2: Grant read-access to holdings + orders.\nStep 3: Your data will sync back automatically.`)}
              className="px-3 py-2 rounded-lg text-[11.5px] font-semibold shrink-0"
              style={{ background: T.primary, color: "#000" }}>
              Connect <ChevronRight size={11} className="inline" />
            </button>
          </div>
        </Card>
      );
    })}
  </div>
);
