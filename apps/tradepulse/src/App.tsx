/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useMemo, useEffect } from "react";

import { AccountsTab } from "@/features/accounts/AccountsTab";
import { AddSheet } from "@/features/portfolio/AddSheet";
import { AlgoTab } from "@/features/algo/AlgoTab";
import { usePortfolio } from "@/data/usePortfolio";
import { CalendarTab } from "@/features/calendar/CalendarTab";
import { DARK_TOKENS, LIGHT_TOKENS, T } from "@/theme/tokens";
import { DashboardTab } from "@/features/dashboard/DashboardTab";
import { IntelligenceTab } from "@/features/intelligence/IntelligenceTab";
import { OpportunitiesTab } from "@/features/opportunities/OpportunitiesTab";
import { OrdersTab } from "@/features/orders/OrdersTab";
import { PortfolioTab } from "@/features/portfolio/PortfolioTab";
import { clearDemo, loadDemoBook } from "@/data/book";
import { addToWatchlist, removeFromWatchlist, useWatchlist } from "@/data/watchlist";
import { PerformanceTab } from "@/features/performance/PerformanceTab";
import { RiskAuditTab } from "@/features/risk/RiskAuditTab";
import { SegmentDrill } from "@/features/portfolio/SegmentDrill";
import { SettingsTab } from "@/features/settings/SettingsTab";
import { Shell } from "@/components/shell/Shell";
import { SignalsTab } from "@/features/signals/SignalsTab";
import { ThemeContext } from "@/theme/ThemeContext";
import { WatchlistView } from "@/features/portfolio/WatchlistView";

export default function TradePulse() {
  const [view, setView] = useState("dashboard");
  const [segmentDrill, setSegmentDrill] = useState(null); // "IN"|"US"|"MF"|"PM"|"CR"|null
  const [watchOpen, setWatchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefault, setAddDefault] = useState("watchlist");

  const [themeMode, setThemeMode] = useState("dark"); // "dark" | "light" | "auto"

  // Resolve effective theme (auto → follow OS preference)
  const effectiveMode = useMemo(() => {
    if (themeMode !== "auto") return themeMode;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }, [themeMode]);

  // Mutate T's properties synchronously during render so all children read the correct palette
  Object.assign(T, effectiveMode === "light" ? LIGHT_TOKENS : DARK_TOKENS);

  // If in auto mode, re-render when OS preference changes
  useEffect(() => {
    if (themeMode !== "auto" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setThemeMode("auto"); // triggers re-render
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, [themeMode]);

  // Holdings come from the user's book (empty on first run; demo or manual
  // rows after that) until a Kite session exists, at which point the Zerodha
  // slice is replaced by the live book. See data/usePortfolio.ts.
  const { holdings, source: holdingsSource, addHolding } = usePortfolio();
  const watchlist = useWatchlist();

  const handleSave = (item) => {
    if (item.mode === "holding") {
      const h = {
        sym: item.sym, qty: item.qty, avg: item.avg, ltp: item.ltp || item.avg,
        dayPct: 0, broker: item.broker, segment: item.segment,
        ...(item.segment === "MF" ? { name: item.sym, current: item.qty * item.ltp, invested: item.qty * item.avg, type: "Regular Growth", amc: item.broker } : {}),
        ...(item.segment === "CR" ? { name: item.sym, current: item.qty * item.ltp, invested: item.qty * item.avg, exchange: item.broker } : {}),
        ...(item.segment === "PM" ? { name: item.sym, current: item.qty * item.ltp, invested: item.qty * item.avg, unit: "g" } : {}),
      };
      addHolding(h);
    } else {
      addToWatchlist({
        id: item.id, sym: item.sym, qty: item.qty, target: item.target, ltp: item.ltp,
        // Whether `ltp` is a price the user actually saw or was backfilled
        // from the target. Dropping it here made every target-only row look
        // priced, and the valuation strip then reported a discount to a
        // "market price" that was really the user's own target.
        ltpEntered: item.ltpEntered,
        segment: item.segment, broker: item.broker, note: item.note, photo: item.photo,
      });
    }
    setAddOpen(false);
  };

  const openAdd = (mode = "watchlist") => { setAddDefault(mode); setAddOpen(true); };

  // Portfolio sub-view routing
  const renderPortfolio = () => {
    if (watchOpen) return <WatchlistView watchlist={watchlist} onAdd={() => openAdd("watchlist")}
      onRemove={id => removeFromWatchlist(id)} onBack={() => setWatchOpen(false)} />;
    if (segmentDrill) return <SegmentDrill segment={segmentDrill} holdings={holdings} onBack={() => setSegmentDrill(null)} />;
    return <PortfolioTab holdings={holdings} watchlist={watchlist} source={holdingsSource}
      onOpenSegment={k => setSegmentDrill(k)}
      onOpenWatchlist={() => setWatchOpen(true)}
      onAdd={() => openAdd("holding")}
      onLoadDemo={loadDemoBook}
      onClearDemo={clearDemo}
      onConnect={() => setView("accounts")} />;
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, effectiveMode }}>
      <Shell view={view} setView={(v) => { setView(v); setSegmentDrill(null); setWatchOpen(false); }}>
        {view === "dashboard"     && <DashboardTab holdings={holdings} setView={setView} />}
        {view === "portfolio"     && renderPortfolio()}
        {view === "intelligence"  && <IntelligenceTab />}
        {view === "signals"       && <SignalsTab />}
        {view === "opportunities" && <OpportunitiesTab />}
        {view === "calendar"      && <CalendarTab />}
        {view === "risk"          && <RiskAuditTab />}
        {view === "performance"   && <PerformanceTab />}
        {view === "orders"        && <OrdersTab />}
        {view === "algo"          && <AlgoTab />}
        {view === "accounts"      && <AccountsTab />}
        {view === "settings"      && <SettingsTab />}

        {addOpen && <AddSheet defaultMode={addDefault} onClose={() => setAddOpen(false)} onSave={handleSave} />}
      </Shell>
    </ThemeContext.Provider>
  );
}
