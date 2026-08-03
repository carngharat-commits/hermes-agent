import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { FONT_MONO, T } from "@/theme/tokens";
import {
  clearKiteRedirectResult,
  getKiteSession,
  getKiteStatus,
  logoutKite,
  readKiteRedirectResult,
  startKiteLogin,
  type KiteSession,
  type KiteStatus,
} from "@/api/kite";

const ERROR_COPY: Record<string, string> = {
  state_mismatch: "That login didn't start here — nothing was connected. Try again.",
  login_cancelled: "Login was cancelled at Zerodha.",
  missing_request_token: "Zerodha didn't return a request token.",
  exchange_failed: "Zerodha rejected the token exchange.",
};

/**
 * Roadmap step 1: live Kite Connect login against the backend in server/.
 * Holdings still come from the bundled snapshot — connecting proves the token
 * round trip, it does not yet replace portfolio data.
 */
export const KiteConnectCard = () => {
  const [status, setStatus] = useState<KiteStatus | null>(null);
  const [session, setSession] = useState<KiteSession | null>(null);
  // The callback bounces back with ?kite_error=… already in the URL, so the
  // banner is known at first render — no effect needed to discover it.
  const [error, setError] = useState<string | null>(() => {
    const { error: code } = readKiteRedirectResult();
    return code ? (ERROR_COPY[code] ?? code) : null;
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Scrubbing the query string is a write to an external system (history),
    // which is exactly what effects are for.
    const redirect = readKiteRedirectResult();
    if (redirect.error || redirect.connected) clearKiteRedirectResult();

    let cancelled = false;
    Promise.all([getKiteStatus(), getKiteSession()])
      .then(([s, sess]) => {
        if (cancelled) return;
        setStatus(s);
        setSession(sess);
      })
      .catch((e) => {
        if (!cancelled) setError(`Backend unreachable — ${e.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const disconnect = async () => {
    setBusy(true);
    try {
      await logoutKite();
      // Holdings are read by usePortfolio() at the app root, which has no way
      // to hear about this. Connecting already costs a full navigation
      // (the OAuth redirect), so disconnecting reloads to match — the whole
      // app then re-reads and falls back to the bundled snapshot.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const connected = session?.authenticated === true;

  return (
    <Card style={{ borderColor: connected ? T.primary : T.border }}>
      <CardHeader
        title="Zerodha Kite Connect"
        subtitle="Roadmap step 1 — live broker authentication"
        icon={RefreshCw}
        right={
          status ? (
            <Pill tone={status.configured ? "up" : "warn"} size="xs">
              {status.configured ? "Live credentials" : "Stub mode"}
            </Pill>
          ) : null
        }
      />

      {error && (
        <div
          className="p-2.5 rounded-lg flex items-start gap-2 mb-3"
          style={{ background: `${T.down}10`, border: `1px solid ${T.down}30` }}
        >
          <AlertTriangle size={13} color={T.down} className="mt-0.5 shrink-0" />
          <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
            {error}
          </div>
        </div>
      )}

      {connected && session.authenticated ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check size={14} color={T.primary} />
            <span className="text-[12.5px] font-semibold">
              Connected as {session.profile.user_name || session.profile.user_id}
            </span>
          </div>
          <div className="text-[10.5px]" style={{ color: T.fgDim, ...FONT_MONO }}>
            {session.profile.user_id} · {session.profile.broker} · logged in{" "}
            {session.profile.login_time || "just now"}
          </div>
          <Btn variant="secondary" size="sm" onClick={disconnect} disabled={busy}>
            Disconnect
          </Btn>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11.5px] leading-relaxed" style={{ color: T.fgMute }}>
            {status && !status.configured
              ? "No Kite API credentials on the backend, so this runs against the local stub — the redirect, session cookie, and logout all work, but no real account is touched."
              : "You'll be sent to Zerodha to authorize read access. The access token stays on the backend; the browser only ever holds an opaque session id."}
          </div>
          <Btn size="sm" onClick={startKiteLogin} disabled={!status}>
            Connect Zerodha
          </Btn>
        </div>
      )}
    </Card>
  );
};
