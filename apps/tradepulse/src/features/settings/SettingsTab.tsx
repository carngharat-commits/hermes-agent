/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Bell, ChevronRight, ClipboardList, Info, Percent, RefreshCw, Settings, Sparkles, Users } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfidenceRow } from "@/features/settings/ConfidenceRow";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { FONT_MONO, T } from "@/theme/tokens";
import { RoadmapCard } from "@/features/settings/RoadmapCard";
import { SettingRow } from "@/features/settings/SettingRow";
import { Toggle3 } from "@/features/settings/Toggle3";
import { ToggleRow } from "@/features/settings/ToggleRow";
import { useAuth } from "@/data/useAuth";
import { AccountPanel } from "@/features/auth/AccountPanel";
import { useThemeMode } from "@/theme/ThemeContext";

export const SettingsTab = () => {
  const auth = useAuth();
  const { themeMode, setThemeMode, effectiveMode } = useThemeMode();
  const [currency, setCurrency] = useState("INR");
  const [notifSignals, setNotifSignals] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifPrice, setNotifPrice] = useState(false);
  const [notifNews, setNotifNews] = useState(true);
  const [syncFreq, setSyncFreq] = useState("15m");
  const [fyStart, setFyStart] = useState("April");
  const [ltcgExempt, setLtcgExempt] = useState(125000);
  const [filingStatus, setFilingStatus] = useState("HUF");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <Settings size={20} color={T.primary} /> Settings
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Customize display, notifications, tax config, and data preferences
        </div>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" icon={Sparkles} />
        <SettingRow label="Theme" sub={themeMode === "auto" ? `Auto · following OS (currently ${effectiveMode})` : "Dark is optimized for market hours"}>
          <Toggle3 value={themeMode} onChange={setThemeMode}
            options={[{k:"dark",l:"Dark"},{k:"light",l:"Light"},{k:"auto",l:"Auto"}]} />
        </SettingRow>
        <SettingRow label="Currency" sub="Primary display currency">
          <Toggle3 value={currency} onChange={setCurrency}
            options={[{k:"INR",l:"₹ INR"},{k:"USD",l:"$ USD"}]} />
        </SettingRow>
        <SettingRow label="Timezone" sub="Fixed for Indian markets">
          <div className="text-[12px]" style={{ color: T.fg, ...FONT_MONO }}>IST (Asia/Kolkata)</div>
        </SettingRow>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader title="Notifications" icon={Bell} />
        <ToggleRow label="Signal alerts" sub="Fires when a new BUY/SELL signal is generated for your holdings"
          value={notifSignals} onChange={setNotifSignals} />
        <ToggleRow label="Market events" sub="RBI, Fed, budget dates, earnings for your book"
          value={notifEvents} onChange={setNotifEvents} />
        <ToggleRow label="Price alerts" sub="Custom triggers you set on watchlist / holdings"
          value={notifPrice} onChange={setNotifPrice} />
        <ToggleRow label="News + geopolitical" sub="Fed cuts, crude spikes, tariff news"
          value={notifNews} onChange={setNotifNews} />
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader title="Data & Sync" icon={RefreshCw} />
        <SettingRow label="Broker sync frequency" sub="How often holdings + LTP are refreshed">
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
            {[{k:"5m",l:"5 min"},{k:"15m",l:"15 min"},{k:"1h",l:"1 hr"},{k:"manual",l:"Manual"}].map(o => (
              <button key={o.k} onClick={() => setSyncFreq(o.k)}
                className="px-3 py-1.5 rounded-md text-[10.5px] font-semibold"
                style={{
                  background: syncFreq === o.k ? T.primary : "transparent",
                  color: syncFreq === o.k ? "#000" : T.fgMute,
                  ...FONT_MONO,
                }}>{o.l}</button>
            ))}
          </div>
        </SettingRow>
      </Card>

      {/* Tax config */}
      <Card>
        <CardHeader title="Tax Configuration" subtitle="Used across Tax Harvest + Advisor modules" icon={Percent} />
        <SettingRow label="Filing status" sub="Individual or HUF">
          <Toggle3 value={filingStatus} onChange={setFilingStatus}
            options={[{k:"Individual",l:"Individual"},{k:"HUF",l:"HUF"},{k:"NRI",l:"NRI"}]} />
        </SettingRow>
        <SettingRow label="FY start" sub="Fiscal year start month">
          <Toggle3 value={fyStart} onChange={setFyStart}
            options={[{k:"April",l:"April"},{k:"January",l:"January"}]} />
        </SettingRow>
        <SettingRow label="LTCG exemption threshold" sub="Currently ₹1.25L for equity (FY26)">
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>₹</span>
            <input type="number" value={ltcgExempt} onChange={e => setLtcgExempt(parseInt(e.target.value) || 0)}
              className="w-28 px-2.5 py-1.5 rounded text-[12px] text-right outline-none"
              style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_MONO }} />
          </div>
        </SettingRow>
        <SettingRow label="STCG rate" sub="Short-term equity gains, currently 20%">
          <div className="text-[12px]" style={{ color: T.fg, ...FONT_MONO }}>20%</div>
        </SettingRow>
        <SettingRow label="LTCG rate" sub="Long-term equity above ₹1.25L, currently 12.5%">
          <div className="text-[12px]" style={{ color: T.fg, ...FONT_MONO }}>12.5%</div>
        </SettingRow>
        <SettingRow label="Crypto (VDA) rate" sub="Section 115BBH flat rate, no offset with equity">
          <div className="text-[12px]" style={{ color: T.warn, ...FONT_MONO }}>30% flat</div>
        </SettingRow>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader title="Data" icon={ClipboardList} />
        <SettingRow label="Export portfolio" sub="Download all holdings + trades">
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={() => alert("Exporting portfolio.csv — download will begin shortly.")}>
              CSV
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => alert("Exporting portfolio.json — download will begin shortly.")}>
              JSON
            </Btn>
          </div>
        </SettingRow>
        <SettingRow label="API documentation" sub="For developers integrating with TradePulse">
          <Btn variant="secondary" size="sm" onClick={() => alert("Opening docs.tradepulse.dev in a new tab...")}>
            Open docs <ChevronRight size={11} />
          </Btn>
        </SettingRow>
      </Card>

      {/* Data Sources & Confidence */}
      <Card>
        <CardHeader title="Data Sources & Confidence" subtitle="What's real vs illustrative in this app" icon={Info}
          right={<DemoBadge label="Guide" note="This section explains which parts of TradePulse use your real data vs which are illustrative placeholders. Sections marked 'Demo' throughout the app will source from real feeds when integrated. Tap each row below for details on that layer." />} />
        <ConfidenceRow tone="up"   pct="98%" label="Zerodha holdings"       note="88 stocks · qty/avg/LTP verified from your Kite screenshots" />
        <ConfidenceRow tone="up"   pct="95%" label="US · INDmoney"           note="7 fractional stocks · verified from screenshots" />
        <ConfidenceRow tone="up"   pct="95%" label="PhonePe metals"          note="Gold + Silver · verified from screenshots" />
        <ConfidenceRow tone="up"   pct="95%" label="Crypto (CoinDCX+WazirX)" note="5 positions · verified from screenshots" />
        <ConfidenceRow tone="warn" pct="90%" label="Mutual Funds"            note="Names + values verified · invested amounts back-solved from returns %, may be 1-2% off" />
        <ConfidenceRow tone="warn" pct="80%" label="ABML holdings"           note="Symbols + qty verified · avg costs approximate (my read summed ₹39K short of statement)" />
        <ConfidenceRow tone="warn" pct="85%" label="Broker registry"         note="Products + pricing correct as of early 2026 bundle read · pricing may have changed" />
        <ConfidenceRow tone="warn" pct="70%" label="Calendar events"         note="Real event types on plausible Aug-Sep 2026 dates" />
        <ConfidenceRow tone="down" pct="50%" label="Geopol impact math"      note="Real events + reasoned impact estimates · not from live scoring model" />
        <ConfidenceRow tone="down" pct="40%" label="Signals · Opportunities" note="Illustrative demo calls · framework is production-ready" />
        <ConfidenceRow tone="down" pct="30%" label="Market indices + flows"  note="Structure real · specific Nifty/VIX/FII/DII numbers illustrative for July 30, 2026" />
        <ConfidenceRow tone="down" pct="30%" label="Expert Views"            note="Analyst names + firms real · quotes and dates fabricated for demo" />
        <ConfidenceRow tone="down" pct="15%" label="Algo backtests"          note="Equity curves are hand-crafted arrays · not from real backtest engine" />
        <div className="pt-3 mt-3 text-[10.5px] text-center" style={{ borderTop: `1px solid ${T.border}`, color: T.fgMute, ...FONT_MONO }}>
          Overall app confidence: ~65% · Portfolio math + shell are solid · Market/signal layers need real feeds to reach production
        </div>
      </Card>

      {/* Roadmap to Production */}
      <RoadmapCard />

      {/* Account */}
      <Card>
        <CardHeader title="Account" icon={Users} />
        <SettingRow label="Signed in as" sub={auth.status === "preview" ? "read-only preview" : `@${auth.user?.username ?? "—"} · ${auth.user?.role ?? ""}`}>
          <div className="text-[12.5px] font-semibold" style={{ color: T.fg }}>{auth.user?.name ?? "Investor"}</div>
        </SettingRow>
        <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={() => { if (confirm("Sign out of TradePulse? This also disconnects the broker session.")) auth.logout(); }}
            className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold"
            style={{ background: `${T.down}12`, color: T.down, border: `1px solid ${T.down}30` }}>
            Sign out
          </button>
        </div>
      </Card>

      <AccountPanel />

      {/* About */}
      <div className="text-center text-[10.5px] pt-4" style={{ color: T.fgDim, ...FONT_MONO }}>
        TradePulse v0.9 (build 20260731)
      </div>
    </div>
  );
};
