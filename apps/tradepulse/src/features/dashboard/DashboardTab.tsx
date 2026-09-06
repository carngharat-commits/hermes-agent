/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bitcoin, ChevronRight, GitCompare, LineChart as LineChartIcon, Newspaper, Percent, RefreshCw, ShieldAlert, Sparkles, Zap } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FLOWS, INSIGHTS, MACRO_TEASER, MARKET, MOOD } from "@/data/market";
import { FONT_MONO, T } from "@/theme/tokens";
import { FlowRow } from "@/features/dashboard/FlowRow";
import { IndexTile } from "@/features/dashboard/IndexTile";
import { InsightCard } from "@/features/dashboard/InsightCard";
import { MoodDial } from "@/features/dashboard/MoodDial";
import { Pill } from "@/components/ui/Pill";
import { PortfolioHistoryChart } from "@/features/dashboard/PortfolioHistoryChart";
import { QuickAction } from "@/features/dashboard/QuickAction";
import { SectorRotationView } from "@/features/dashboard/SectorRotationView";
import { SegmentTile } from "@/features/dashboard/SegmentTile";
import { useAuth } from "@/data/useAuth";
import { inrCompact, pct, toINR_us } from "@/lib/format";

export const DashboardTab = ({ holdings, setView }: any) => {
  const firstName = (useAuth().user?.name ?? "Investor").split(" ")[0];
  // Consolidated totals
  const totals = useMemo(() => {
    const inH = holdings.filter(h => h.segment === "IN");
    const us  = holdings.filter(h => h.segment === "US");
    const mf  = holdings.filter(h => h.segment === "MF");
    const cr  = holdings.filter(h => h.segment === "CR");
    const pm  = holdings.filter(h => h.segment === "PM");
    const inCV  = inH.reduce((s, h) => s + h.qty * h.ltp, 0);
    const inIV  = inH.reduce((s, h) => s + h.qty * (h.avg || h.ltp), 0);
    const usCV  = us.reduce((s, h)  => s + toINR_us(h.qty * h.ltp), 0);
    const usIV  = us.reduce((s, h)  => s + toINR_us(h.qty * (h.avg || h.ltp)), 0);
    const mfCV  = mf.reduce((s, h)  => s + (h.current  || 0), 0);
    const mfIV  = mf.reduce((s, h)  => s + (h.invested || 0), 0);
    const crCV  = cr.reduce((s, h)  => s + (h.current  || 0), 0);
    const crIV  = cr.reduce((s, h)  => s + (h.invested || 0), 0);
    const pmCV  = pm.reduce((s, h)  => s + (h.current  || 0), 0);
    const pmIV  = pm.reduce((s, h)  => s + (h.invested || 0), 0);
    const totalCV = inCV + usCV + mfCV + crCV + pmCV;
    const totalIV = inIV + usIV + mfIV + crIV + pmIV;
    const totalPL = totalCV - totalIV;
    const totalPct = totalIV > 0 ? (totalPL / totalIV) * 100 : 0;
    const dayChg = holdings.reduce((s, h) => {
      const v = h.segment === "IN" ? h.qty * h.ltp * (h.dayPct || 0) / 100
              : h.segment === "US" ? toINR_us(h.qty * h.ltp) * (h.dayPct || 0) / 100
              : (h.current || 0) * (h.dayPct || 0) / 100;
      return s + v;
    }, 0);
    const dayPct = totalCV > 0 ? (dayChg / (totalCV - dayChg)) * 100 : 0;
    return { totalCV, totalIV, totalPL, totalPct, dayChg, dayPct, inCV, usCV, mfCV, crCV, pmCV };
  }, [holdings]);

  return (
    <div className="space-y-5">
      {/* Header line */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Good morning, {firstName}</h1>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            Consolidated view across Zerodha · ABML · INDmoney · Groww · CoinDCX · WazirX · PhonePe
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="up"><span>●</span> Markets Open</Pill>
          <Pill tone="neutral">30 Jul 2026</Pill>
        </div>
      </div>

      {/* Row 1: Net worth + Portfolio summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Net worth big card */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.15em] font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>
                Net Worth · Consolidated
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[32px] font-bold tracking-tight" style={FONT_MONO}>{inrCompact(totals.totalCV)}</span>
                <span className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                  ₹{Math.round(totals.totalCV).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Pill tone={totals.dayChg >= 0 ? "up" : "down"}>
                  {totals.dayChg >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {inrCompact(Math.abs(totals.dayChg))} · {pct(totals.dayPct, 2)} today
                </Pill>
                <Pill tone={totals.totalPL >= 0 ? "up" : "down"}>
                  Overall {inrCompact(Math.abs(totals.totalPL))} · {pct(totals.totalPct, 2)}
                </Pill>
              </div>
            </div>
            <Btn variant="secondary" size="sm" onClick={() => setView("portfolio")}>
              View portfolio <ChevronRight size={12} />
            </Btn>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
            <SegmentTile label="Indian Eq"     v={totals.inCV} color={T.info}    onClick={() => setView("portfolio")} />
            <SegmentTile label="US Eq"         v={totals.usCV} color="#22d3ee"   onClick={() => setView("portfolio")} />
            <SegmentTile label="Mutual Funds"  v={totals.mfCV} color={T.violet}  onClick={() => setView("portfolio")} />
            <SegmentTile label="Metals"        v={totals.pmCV} color="#fbbf24"   onClick={() => setView("portfolio")} />
            <SegmentTile label="Crypto"        v={totals.crCV} color={T.warn}    onClick={() => setView("portfolio")} />
          </div>
        </Card>

        {/* Market Mood */}
        <Card>
          <CardHeader title="Market Mood" subtitle={`${MOOD.phase} · Nifty PCR ${MARKET.niftypcr}`} icon={Activity} />
          <MoodDial score={MOOD.score} label={MOOD.label} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
            {Object.entries(MOOD.breakdown).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span style={{ color: T.fgMute }} className="capitalize">{k}</span>
                  <span style={{ ...FONT_MONO, color: T.fg }}>{v.toFixed(1)}</span>
                </div>
                <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: T.subtle }}>
                  <div className="h-full rounded-full" style={{ width: `${v * 10}%`, background: v >= 7 ? T.up : v >= 5 ? T.warn : T.down }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Portfolio history chart with 7D/1M/3M/1Y/All timeframe selector */}
      <PortfolioHistoryChart totals={totals} />

      {/* Row 2: Market indices + FII/DII */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Live Market Data" subtitle="NSE snapshot" icon={LineChartIcon}
            right={<div className="flex items-center gap-1.5"><Pill tone="up"><span>●</span> Live</Pill><DemoBadge note="Nifty/Sensex/BankNifty/IndiaVIX values shown are illustrative snapshot values for 30 July 2026. In production, these come from live NSE + BSE feeds via broker APIs or NSE/BSE websocket. The tile layout, up/down coloring, and PCR/delivery percentage math are production-ready — only the specific numbers are stand-ins." />
            </div>} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IndexTile name="NIFTY 50" data={MARKET.nifty} />
            <IndexTile name="SENSEX" data={MARKET.sensex} />
            <IndexTile name="BANKNIFTY" data={MARKET.banknifty} />
            <IndexTile name="INDIA VIX" data={MARKET.indiavix} lowerIsBetter />
          </div>
        </Card>

        <Card>
          <CardHeader title="Institutional Flows" subtitle="Session + 5-day" icon={Zap}
            right={<DemoBadge note="FII/DII flow numbers are illustrative for 30 July 2026. Real source in production: SEBI/NSE end-of-day flow reports, or Bloomberg/Moneycontrol feed. The framework (session + 5-day trend, accumulating/distributing classification, contribution to market mood) is production-quality." />} />
          <FlowRow label="FII" data={FLOWS.fii} tone={FLOWS.fii.session >= 0 ? "up" : "down"} />
          <div className="my-3 h-px" style={{ background: T.border }} />
          <FlowRow label="DII" data={FLOWS.dii} tone={FLOWS.dii.session >= 0 ? "up" : "down"} />
          <div className="mt-4 p-2.5 rounded-lg text-[11px]" style={{ background: `${T.up}10`, border: `1px solid ${T.up}30` }}>
            Both FII + DII net buyers — <span className="font-semibold" style={{ color: T.up }}>flows supportive</span>. Nifty PCR at 1.18 signals bullish setup.
          </div>
        </Card>
      </div>

      {/* Row 3: Actionable Insights */}
      <Card>
        <CardHeader title="Top Actionable Insights" subtitle="Personalised to your holdings" icon={Sparkles}
          right={<Btn variant="ghost" size="sm" onClick={() => setView("intelligence")}>See all <ChevronRight size={11} /></Btn>} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {INSIGHTS.slice(0, 4).map(x => <InsightCard key={x.id} x={x} setView={setView} />)}
        </div>
      </Card>

      {/* Row 4: Macro teaser + Sector rotation phase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Morning Intelligence Brief" subtitle="30 Jul 2026" icon={Newspaper}
            right={<Btn variant="ghost" size="sm" onClick={() => setView("intelligence")}>Full brief <ChevronRight size={11} /></Btn>} />
          <p className="text-[12.5px] leading-relaxed" style={{ color: T.fg }}>{MACRO_TEASER.brief}</p>
          <div className="mt-4">
            <div className="text-[10.5px] uppercase tracking-[0.15em] font-semibold mb-2" style={{ color: T.fgMute, ...FONT_MONO }}>
              Upcoming events
            </div>
            <div className="space-y-1.5">
              {MACRO_TEASER.events.map(e => (
                <div key={e.d} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
                  <div className="text-[11px] font-semibold w-14 shrink-0" style={{ color: T.fgMute, ...FONT_MONO }}>{e.d}</div>
                  <div className="text-[12px] flex-1">{e.label}</div>
                  <Pill tone={e.weight === "HIGH" ? "down" : "warn"} size="xs">{e.weight}</Pill>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sector Rotation" subtitle={`Cycle phase · ${MOOD.phase}`} icon={GitCompare}
            right={<Pill tone="warn">{MOOD.phase}</Pill>} />
          <SectorRotationView holdings={holdings} />
        </Card>
      </div>

      {/* Advisor / What next */}
      <Card>
        <CardHeader title="What next?" subtitle="Skip to the modules that need your attention" icon={ChevronRight} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction label="Tax Harvest" desc="6 losers to book" tone="down" onClick={() => setView("risk")} icon={ShieldAlert} />
          <QuickAction label="Rebalance" desc="MF-heavy · drift 14%" tone="warn" onClick={() => setView("risk")} icon={RefreshCw} />
          <QuickAction label="Crypto Plan" desc="SHIB/WIN cut" tone="info" onClick={() => setView("risk")} icon={Bitcoin} />
          <QuickAction label="MF Costs" desc="₹17K/yr leak" tone="violet" onClick={() => setView("risk")} icon={Percent} />
        </div>
      </Card>
    </div>
  );
};
