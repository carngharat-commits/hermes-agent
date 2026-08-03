/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Brain, Calendar, GitCompare, Globe, Newspaper, Users } from "lucide-react";

import { BigMovesView } from "@/features/intelligence/BigMovesView";
import { ExpertViewsView } from "@/features/intelligence/ExpertViewsView";
import { GEOPOL_EVENTS, INVESTOR_MOVES } from "@/data/intelligence";
import { GeopoliticalEventsView } from "@/features/intelligence/GeopoliticalEventsView";
import { MorningBriefView } from "@/features/intelligence/MorningBriefView";
import { Pill } from "@/components/ui/Pill";
import { SeasonalPatternsView } from "@/features/intelligence/SeasonalPatternsView";
import { SectorRotationDeepView } from "@/features/intelligence/SectorRotationDeepView";
import { T } from "@/theme/tokens";

export const IntelligenceTab = () => {
  const [tab, setTab] = useState("brief"); // brief | events | bigmoves | experts | rotation | seasonal
  const tabs = [
    { k:"brief",    l:"Morning Brief",   ic:Newspaper },
    { k:"events",   l:"Geo Events",      ic:Globe, badge: GEOPOL_EVENTS.length },
    { k:"bigmoves", l:"Big Moves",       ic:Users, badge: INVESTOR_MOVES.length },
    { k:"experts",  l:"Expert Views",    ic:Users },
    { k:"rotation", l:"Sector Rotation", ic:GitCompare },
    { k:"seasonal", l:"Seasonal",        ic:Calendar },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <Brain size={20} color={T.primary} /> Intelligence
          </h1>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            Curated market intelligence with per-holding impact analysis
          </div>
        </div>
        <Pill tone="up"><span>●</span> Live · updated 08:32 IST</Pill>
      </div>

      {/* Sub-nav */}
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
              {t.badge && <Pill tone={active ? "up" : "neutral"} size="xs">{t.badge}</Pill>}
            </button>
          );
        })}
      </div>

      {tab === "brief"    && <MorningBriefView />}
      {tab === "events"   && <GeopoliticalEventsView />}
      {tab === "bigmoves" && <BigMovesView />}
      {tab === "experts"  && <ExpertViewsView />}
      {tab === "rotation" && <SectorRotationDeepView />}
      {tab === "seasonal" && <SeasonalPatternsView />}
    </div>
  );
};
