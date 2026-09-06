import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserPlus } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { FONT_MONO, T } from "@/theme/tokens";
import { useAuth } from "@/data/auth";

/**
 * The lock in front of the app.
 *
 * Two forms on one screen. On a fresh install there are no accounts, so the
 * screen offers to create the first one — it becomes the owner, and the
 * owner adds everyone else from Settings. There is no open sign-up. After
 * that it is a plain username and password; the backend enforces both on
 * every /api route, this screen only asks.
 */
export const LoginScreen = () => {
  const { status, error, login, setup, enterPreview } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSetup = status === "setup";
  const unreachable = status === "unreachable";
  const mismatch = isSetup && confirm.length > 0 && confirm !== password;
  const ready = username.trim().length >= 3 && password.length >= (isSetup ? 10 : 1)
    && (!isSetup || (confirm === password && name.trim().length > 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    if (isSetup) await setup({ name: name.trim(), username: username.trim(), password });
    else await login({ username: username.trim(), password });
    setBusy(false);
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void,
                 type = "text", extra: Record<string, any> = {}) => (
    <div className="mt-3 first:mt-0">
      <label className="block text-[10.5px] uppercase tracking-[0.12em] mb-1.5"
        style={{ color: T.fgDim, ...FONT_MONO }} htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => set(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-[13px]"
        style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}` }} {...extra} />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: T.bg, color: T.fg }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-2xl p-6"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${T.primary}18`, border: `1px solid ${T.primary}30` }}>
            {isSetup ? <UserPlus size={18} color={T.primary} /> : <LockKeyhole size={18} color={T.primary} />}
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">TradePulse</div>
            <div className="text-[11px]" style={{ color: T.fgMute }}>
              {unreachable ? "Backend not reachable" : isSetup ? "Create the first account" : "Sign in to continue"}
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
            {isSetup && (
              <p className="text-[11.5px] leading-relaxed mb-4" style={{ color: T.fgMute }}>
                No accounts exist yet. This one becomes the owner and can add others
                from Settings. There is no open sign-up after this.
              </p>
            )}
            {isSetup && field("name", "Your name", name, setName, "text", { autoComplete: "name", autoFocus: true })}
            {field("username", "Username", username, setUsername, "text",
              { autoComplete: "username", autoCapitalize: "none", spellCheck: false, autoFocus: !isSetup })}
            <div className="mt-3">
              <label className="block text-[10.5px] uppercase tracking-[0.12em] mb-1.5"
                style={{ color: T.fgDim, ...FONT_MONO }} htmlFor="password">
                Password{isSetup && <span style={{ color: T.fgDim }}> · at least 10 characters</span>}
              </label>
              <div className="flex items-stretch gap-2">
                <input id="password" type={show ? "text" : "password"}
                  autoComplete={isSetup ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2.5 text-[13px]"
                  style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}`, ...FONT_MONO }} />
                <button type="button" onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="w-10 rounded-lg flex items-center justify-center"
                  style={{ background: T.card2, border: `1px solid ${T.border}` }}>
                  {show ? <EyeOff size={14} color={T.fgMute} /> : <Eye size={14} color={T.fgMute} />}
                </button>
              </div>
            </div>
            {isSetup && field("confirm", "Confirm password", confirm, setConfirm, show ? "text" : "password",
              { autoComplete: "new-password" })}
            {mismatch && (
              <div className="mt-2 text-[11px]" style={{ color: T.warn }}>The two passwords differ.</div>
            )}

            {error && (
              <div role="alert" className="mt-3 text-[11.5px] rounded-lg px-3 py-2"
                style={{ background: `${T.down}12`, color: T.down, border: `1px solid ${T.down}30` }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={!ready || busy}
              className="w-full mt-4 py-2.5 rounded-lg text-[12.5px] font-semibold"
              style={{ background: T.primary, color: "#000", opacity: !ready || busy ? 0.5 : 1 }}>
              {busy ? (isSetup ? "Creating…" : "Signing in…") : isSetup ? "Create account" : "Sign in"}
            </button>

            {!isSetup && (
              <p className="text-[10.5px] mt-4 leading-relaxed" style={{ color: T.fgDim }}>
                No account? The owner adds accounts from Settings. Forgotten password?
                The owner can set a new one.
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
};
