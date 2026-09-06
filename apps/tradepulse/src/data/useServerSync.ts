import { useEffect } from "react";

import { bookStore } from "@/data/book";
import { useAuth } from "@/data/auth";
import { watchlistStore } from "@/data/watchlist";

/**
 * Ties the persisted stores to the session. Signed in: pull, then push on
 * change. Signed out: clear, so a shared device does not hand the next
 * person the last person's book. Preview (no backend): local only.
 */
export function useServerSync(): void {
  const { status } = useAuth();
  useEffect(() => {
    if (status === "authenticated") {
      bookStore.startSync();
      watchlistStore.startSync();
    } else if (status === "anonymous") {
      bookStore.stopSyncAndClear();
      watchlistStore.stopSyncAndClear();
    }
  }, [status]);
}
