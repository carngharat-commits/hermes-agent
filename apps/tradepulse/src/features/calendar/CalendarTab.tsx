/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo } from "react";
import { Calendar } from "lucide-react";

import { CALENDAR } from "@/data/trading";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { IN_STOCKS, US_STOCKS } from "@/data/holdings";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";

export const CalendarTab = () => {
  const [filter, setFilter] = useState("all"); // all | earnings | macro | geopol | holiday
  const [horizon, setHorizon] = useState(30); // 7 | 30 | 60 days
  const holdingSyms = useMemo(() => new Set([
    ...IN_STOCKS.map(h => h.sym),
    ...US_STOCKS.map(h => h.sym),
  ]), []);
  const today = new Date("2026-07-31");
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + horizon);

  const filtered = useMemo(() => {
    return CALENDAR
      .filter(ev => new Date(ev.d) <= cutoff && new Date(ev.d) >= today)
      .filter(ev => filter === "all" || ev.type === filter)
      .sort((a, b) => +new Date(a.d) - +new Date(b.d));
  }, [filter, horizon]);

  const typeColors = { earnings:T.up, macro:T.info, geopol:T.violet, index:T.warn, holiday:T.fgMute };
  const typeLabels = { earnings:"Earnings", macro:"Macro", geopol:"Geo", index:"Index", holiday:"Holiday" };

  const highWeight = filtered.filter(e => e.weight === "HIGH").length;
  const affectedHoldings = new Set();
  filtered.forEach(e => e.affects.forEach(a => { if (holdingSyms.has(a)) affectedHoldings.add(a); }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <Calendar size={20} color={T.primary} /> Calendar
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Earnings · macro prints · geopolitical events — flagged when they touch your book
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <KV k="Events" v={filtered.length.toString()} sub={`Next ${horizon} days`} />
        </Card>
        <Card>
          <KV k="High-weight" v={highWeight.toString()} tone={highWeight > 3 ? "down" : "neutral"} sub="Market movers" />
        </Card>
        <Card>
          <KV k="Your holdings" v={affectedHoldings.size.toString()} tone="up" sub="Affected" />
        </Card>
      </div>

      {/* Horizon + type filters */}
      <Card padded={false} className="p-3 space-y-2">
        <div className="flex gap-1.5">
          {[7, 30, 60].map(d => (
            <button key={d} onClick={() => setHorizon(d)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex-1"
              style={{
                background: horizon === d ? T.fg : "transparent",
                color: horizon === d ? T.bg : T.fgMute,
                border: `1px solid ${horizon === d ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>Next {d} days</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k:"all",      l:"All" },
            { k:"earnings", l:"Earnings" },
            { k:"macro",    l:"Macro" },
            { k:"geopol",   l:"Geopolitical" },
            { k:"index",    l:"Index" },
            { k:"holiday",  l:"Holidays" },
          ].map(o => (
            <button key={o.k} onClick={() => setFilter(o.k)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: filter === o.k ? T.card2 : "transparent",
                color: filter === o.k ? T.fg : T.fgMute,
                border: `1px solid ${filter === o.k ? T.primary : T.border}`,
                ...FONT_MONO,
              }}>{o.l}</button>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Card><div className="py-6 text-center text-[13px]" style={{ color: T.fgMute }}>No events in this window</div></Card>
      ) : (
        <Card padded={false}>
          {filtered.map(ev => {
            const dt = new Date(ev.d);
            const dayShort = dt.toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
            const weekday = dt.toLocaleDateString("en-IN", { weekday:"short" });
            const holdingCount = ev.affects.filter(a => holdingSyms.has(a)).length;
            const tColor = typeColors[ev.type];
            return (
              <Row key={ev.d + ev.label}>
                <div className="flex items-start gap-3">
                  <div className="text-center shrink-0" style={{ minWidth: 44 }}>
                    <div className="text-[10.5px] uppercase font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>{weekday}</div>
                    <div className="text-[13px] font-bold mt-0.5" style={{ color: T.fg, ...FONT_MONO }}>{dayShort}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                        style={{ background: `${tColor}18`, color: tColor, border: `1px solid ${tColor}40`, ...FONT_MONO }}>
                        {typeLabels[ev.type]}
                      </span>
                      <Pill tone={ev.weight === "HIGH" ? "down" : ev.weight === "MED" ? "warn" : "neutral"} size="xs">{ev.weight}</Pill>
                      {holdingCount > 0 && <Pill tone="up" size="xs">{holdingCount} of yours</Pill>}
                    </div>
                    <div className="text-[13px] font-semibold leading-tight">{ev.label}</div>
                    {ev.affects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ev.affects.slice(0, 8).map(a => {
                          const owned = holdingSyms.has(a);
                          return (
                            <span key={a}
                              className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: owned ? `${T.primary}18` : T.subtle2,
                                color: owned ? T.primary : T.fgMute,
                                border: owned ? `1px solid ${T.primary}40` : "1px solid transparent",
                                ...FONT_MONO,
                              }}>{a}</span>
                          );
                        })}
                        {ev.affects.length > 8 && (
                          <span className="text-[9.5px] px-1.5 py-0.5 font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>
                            +{ev.affects.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Row>
            );
          })}
        </Card>
      )}
    </div>
  );
};
