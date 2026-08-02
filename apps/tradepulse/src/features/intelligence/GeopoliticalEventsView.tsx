/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { GEOPOL_EVENTS } from "@/data/intelligence";
import { GeopolEventCard } from "@/features/intelligence/GeopolEventCard";
import { inrCompact } from "@/lib/format";

export const GeopoliticalEventsView = () => {
  const totalImpact = GEOPOL_EVENTS.reduce((s, e) => s + (e.total || 0), 0);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="text-[13px] font-semibold">Net portfolio impact · this week</div>
              <DemoBadge label="Estimated" note="Event types and dates (Fed dovish tilt, crude softening, RBI preview, China GDP miss, Q2 earnings, Trump tariff talk) reflect real macro themes. However, the per-holding rupee impact numbers are estimated illustrations — I calculated them from plausible sensitivities (crude → refining margin math, Fed → growth stock re-rating, etc.), not from a live impact-scoring model. In production, these would come from: (1) a news feed like Reuters/Bloomberg, (2) an impact-scoring engine that maps events to sector/stock sensitivities, and (3) real-time repricing based on your position sizes." />
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: T.fgMute }}>
              Aggregate value change from {GEOPOL_EVENTS.length} events
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[22px] font-bold" style={{ color: totalImpact >= 0 ? T.up : T.down, ...FONT_MONO }}>
              {totalImpact >= 0 ? "+" : "−"}{inrCompact(Math.abs(totalImpact))}
            </div>
          </div>
        </div>
      </Card>

      {GEOPOL_EVENTS.map(e => <GeopolEventCard key={e.id} e={e} />)}
    </div>
  );
};
