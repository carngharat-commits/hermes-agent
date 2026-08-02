/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Users } from "lucide-react";

import { APIKeysView } from "@/features/accounts/APIKeysView";
import { AvailableBrokersView } from "@/features/accounts/AvailableBrokersView";
import { BROKERS_AVAILABLE, BROKERS_CONNECTED } from "@/data/brokers";
import { Card } from "@/components/ui/Card";
import { ConnectedBrokersView } from "@/features/accounts/ConnectedBrokersView";
import { KV } from "@/components/ui/KV";
import { Pill } from "@/components/ui/Pill";
import { T } from "@/theme/tokens";

export const AccountsTab = () => {
  const [tab, setTab] = useState("connected");
  const totalHoldings = BROKERS_CONNECTED.reduce((s, b) => s + b.holdings, 0);
  const activeBrokers = BROKERS_CONNECTED.filter(b => b.status === "active").length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
          <Users size={20} color={T.primary} /> Broker Accounts
        </h1>
        <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
          Consolidated broker registry — connect once, see everything
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><KV k="Connected" v={BROKERS_CONNECTED.length.toString()} tone="up" sub={`${activeBrokers} live-syncing`} /></Card>
        <Card><KV k="Holdings synced" v={totalHoldings.toString()} sub="Across all brokers" /></Card>
        <Card><KV k="Available to add" v={BROKERS_AVAILABLE.length.toString()} tone="info" sub="Free + paid" /></Card>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { k:"connected", l:"Connected",   n:BROKERS_CONNECTED.length },
          { k:"available", l:"Available",   n:BROKERS_AVAILABLE.length },
          { k:"apikeys",   l:"API Keys",    n:0 },
        ].map(o => (
          <button key={o.k} onClick={() => setTab(o.k)}
            className="px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
            style={{
              background: tab === o.k ? `${T.primary}18` : T.card2,
              color: tab === o.k ? T.primary : T.fg,
              border: `1px solid ${tab === o.k ? `${T.primary}40` : T.border}`,
            }}>
            <span className="text-[11.5px] font-semibold">{o.l}</span>
            <Pill tone={tab === o.k ? "up" : "neutral"} size="xs">{o.n}</Pill>
          </button>
        ))}
      </div>

      {tab === "connected" && <ConnectedBrokersView />}
      {tab === "available" && <AvailableBrokersView />}
      {tab === "apikeys"   && <APIKeysView />}
    </div>
  );
};
