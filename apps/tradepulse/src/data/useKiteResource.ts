import { useCallback, useEffect, useState } from "react";

import { getKiteSession } from "@/api/kite";

export type KiteResource<T> = {
  /** null whenever nothing is connected, or the fetch failed. */
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Loads one Kite-backed resource, or nothing when no broker is connected.
 *
 * Every caller has the same fallback contract: not being connected is the
 * normal state and not an error, and a failed fetch leaves `data` null so the
 * caller can fall back to the bundled snapshot rather than render an empty
 * screen.
 */
export function useKiteResource<T>(
  load: () => Promise<T>,
  describeGaps?: (data: T) => string | null,
): KiteResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const session = await getKiteSession();
        if (!session.authenticated) {
          if (!cancelled) {
            setData(null);
            setError(null);
          }
          return;
        }
        const fetched = await load();
        if (!cancelled) {
          setData(fetched);
          setError(describeGaps?.(fetched) ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `load` and `describeGaps` are stable module-level functions at every
    // call site; re-running on identity would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, refresh };
}
