import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { FONT_MONO, T } from "@/theme/tokens";
import { useAuth } from "@/data/auth";

/**
 * The lock in front of the app.
 *
 * Kept to one field on purpose: this is a single-user app and a passcode is
 * the smallest thing that is actually a lock. The backend enforces it on
 * every /api route; this screen only asks for it.
 */
export const LoginScreen = () => {
  const { status, error, login, enterPreview } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    await login(passcode);
    setBusy(false);
  };

  const unreachable = status === "unreachable";

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: T.bg, color: T.fg }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-2xl p-6"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${T.primary}18`, border: `1px solid ${T.primary}30` }}>
            <LockKeyhole size={18} color={T.primary} />
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">TradePulse</div>
            <div className="text-[11px]" style={{ color: T.fgMute }}>
              {unreachable ? "Backend not reachable" : "Sign in to continue"}
            </div>
          </div>
        </div>

        {unreachable ? (
          <>
            <p className="text-[12px] leading-relaxed" style={{ color: T.fgMute }}>
              This page has no backend behind it, so there is nothing to sign in to
              and nothing private to reach. You can look around a read-only preview:
              the screens work, the demo book loads, and every AI figure is a stub.
            </p>
            <Btn className="w-full mt-4" onClick={enterPreview}>Open read-only preview</Btn>
          </>
        ) : (
          <>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] mb-1.5"
              style={{ color: T.fgDim, ...FONT_MONO }} htmlFor="passcode">
              Passcode
            </label>
            <div className="flex items-stretch gap-2">
              <input
                id="passcode"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••••••"
                className="flex-1 rounded-lg px-3 py-2.5 text-[13px]"
                style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}`, ...FONT_MONO }}
              />
              <button type="button" onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide passcode" : "Show passcode"}
                className="w-10 rounded-lg flex items-center justify-center"
                style={{ background: T.card2, border: `1px solid ${T.border}` }}>
                {show ? <EyeOff size={14} color={T.fgMute} /> : <Eye size={14} color={T.fgMute} />}
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-3 text-[11.5px] rounded-lg px-3 py-2"
                style={{ background: `${T.down}12`, color: T.down, border: `1px solid ${T.down}30` }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={!passcode || busy}
              className="w-full mt-4 py-2.5 rounded-lg text-[12.5px] font-semibold"
              style={{ background: T.primary, color: "#000", opacity: !passcode || busy ? 0.5 : 1 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-[10.5px] mt-4 leading-relaxed" style={{ color: T.fgDim }}>
              The passcode is set on the server (TRADEPULSE_PASSCODE). If none was
              set, the backend printed a one-time passcode when it started.
            </p>
          </>
        )}
      </form>
    </div>
  );
};
