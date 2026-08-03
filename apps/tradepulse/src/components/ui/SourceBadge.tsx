import { Pill } from "@/components/ui/Pill";
import type { HoldingsSource } from "@/data/usePortfolio";

const COPY: Record<HoldingsSource, { tone: string; label: string; note: string }> = {
  live: {
    tone: "up",
    label: "Kite live",
    note:
      "Zerodha rows are synced live from Kite Connect. Every other account " +
      "(ABML, INDmoney, mutual funds, crypto, metals) is still the bundled " +
      "snapshot — nothing has been connected that can speak for them.",
  },
  stub: {
    tone: "warn",
    label: "Kite stub",
    note:
      "The backend has no Kite API credentials, so Zerodha rows are fixture " +
      "data served by the local stub. They are not a real book. Set " +
      "KITE_API_KEY and KITE_API_SECRET to sync the actual account.",
  },
  snapshot: {
    tone: "neutral",
    label: "Snapshot",
    note:
      "No broker is connected, so every holding is the snapshot bundled with " +
      "the app. Connect Zerodha under Accounts to sync that slice live.",
  },
};

/** Says where the numbers on screen came from. Tap for the full caveat. */
export const SourceBadge = ({ source }: { source: HoldingsSource }) => {
  const { tone, label, note } = COPY[source];
  return (
    <button onClick={() => alert(`Holdings source: ${label}\n\n${note}`)} title={note}>
      <Pill tone={tone} size="xs">
        {label}
      </Pill>
    </button>
  );
};
