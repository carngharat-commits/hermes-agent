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
  empty: {
    tone: "neutral",
    label: "Empty",
    note:
      "Nothing is in the book yet. Add a position, connect Zerodha under " +
      "Accounts, or load the demo book to see every screen with sample data.",
  },
  demo: {
    tone: "warn",
    label: "Demo book",
    note:
      "These are sample holdings, not anyone's real positions. They exist so " +
      "every screen has something to show. Clear them under Portfolio when " +
      "you start entering your own.",
  },
  manual: {
    tone: "info",
    label: "Entered by you",
    note:
      "Every holding here was typed in on this device. It is stored in this " +
      "browser only. Connect Zerodha under Accounts to sync that slice live.",
  },
  mixed: {
    tone: "warn",
    label: "Demo + yours",
    note:
      "The demo book is loaded alongside holdings you entered. Totals mix " +
      "sample rows with real ones — clear the demo under Portfolio to keep " +
      "only yours.",
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
