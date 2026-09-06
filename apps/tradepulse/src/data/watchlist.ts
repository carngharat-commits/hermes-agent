/**
 * The watchlist: scripts the user is tracking but does not own.
 *
 * Same `PersistedStore` as the book, for the same reasons: it used to be
 * `useState` in App.tsx, gone on reload and invisible from any other device.
 */

import { PersistedStore, useStore } from "@/data/store";

export type WatchlistEntry = {
  id: string;
  sym: string;
  segment: string;
  qty: number;
  target: number;
  ltp: number;
  ltpEntered?: boolean;
  broker?: string;
  note?: string;
  photo?: string | null;
};

type Stored = { entries: WatchlistEntry[] };

export const watchlistStore = new PersistedStore<Stored>(
  "watchlist",
  "tradepulse.watchlist.v1",
  () => ({ entries: [] }),
  (s) => s.entries.length === 0,
);

export function useWatchlist(): WatchlistEntry[] {
  return useStore(watchlistStore).entries;
}

export function addToWatchlist(entry: WatchlistEntry): void {
  watchlistStore.set({ entries: [entry, ...watchlistStore.get().entries] });
}

export function removeFromWatchlist(id: string): void {
  watchlistStore.set({ entries: watchlistStore.get().entries.filter((w) => w.id !== id) });
}
