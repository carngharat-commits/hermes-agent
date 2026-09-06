/**
 * Who is using the app, and whether they may.
 *
 * The backend is the lock — every /api route returns 401 without its cookie.
 * This hook only decides what to *show*: first-run setup, the sign-in, the
 * app, or (when there is no backend at all, as in a published prototype) a
 * read-only preview that says so on screen. The preview is not a way around
 * the lock: with no backend there is nothing behind it to reach.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAuthSession, login as apiLogin, logout as apiLogout, setupFirstAccount,
  type AuthUser, type Credentials, type NewAccount,
} from "@/api/auth";
import { AuthContext, type AuthState, type AuthStatus } from "@/data/useAuth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthSession()
      .then((session) => {
        if (cancelled) return;
        setRequired(session.required);
        if (session.authenticated) {
          setUser(session.user);
          setStatus("authenticated");
        } else {
          setStatus(session.setup_required ? "setup" : "anonymous");
        }
      })
      .catch(() => {
        // A 401 is an answer; a network failure is the absence of one.
        if (!cancelled) setStatus("unreachable");
      });
    return () => { cancelled = true; };
  }, []);

  const finish = (session: Awaited<ReturnType<typeof apiLogin>>) => {
    if (session.authenticated) {
      setUser(session.user);
      setStatus("authenticated");
      return true;
    }
    setError("Sign-in did not complete.");
    return false;
  };

  const login = useCallback(async (credentials: Credentials) => {
    setError(null);
    try { return finish(await apiLogin(credentials)); }
    catch (e) { setError((e as Error).message); return false; }
  }, []);

  const setup = useCallback(async (account: NewAccount) => {
    setError(null);
    try { return finish(await setupFirstAccount(account)); }
    catch (e) { setError((e as Error).message); return false; }
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* signed out locally regardless */ }
    setUser(null);
    setStatus("anonymous");
  }, []);

  const enterPreview = useCallback(() => setStatus("preview"), []);

  const value = useMemo<AuthState>(
    () => ({ status, user, required, error, login, setup, logout, enterPreview }),
    [status, user, required, error, login, setup, logout, enterPreview],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
