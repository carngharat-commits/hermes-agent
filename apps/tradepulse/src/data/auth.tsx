/**
 * Who is using the app, and whether they may.
 *
 * The backend is the lock — every /api route returns 401 without its cookie.
 * This hook only decides what to *show*: the login screen, the app, or (when
 * there is no backend at all, as in a published prototype) a read-only
 * preview that says so on screen. The preview is not a way around the lock:
 * with no backend there is nothing behind it to reach.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getAuthSession, login as apiLogin, logout as apiLogout, type AuthUser } from "@/api/auth";

export type AuthStatus =
  | "checking"        // first request in flight
  | "anonymous"       // backend answered: sign in
  | "authenticated"   // backend answered: in
  | "unreachable"     // no backend (network error) — offer the preview
  | "preview";        // user chose to look around without a backend

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  required: boolean;
  error: string | null;
  login: (passcode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  enterPreview: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "TP";

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
          setStatus("anonymous");
        }
      })
      .catch(() => {
        // A 401 is an answer; a network failure is the absence of one.
        if (!cancelled) setStatus("unreachable");
      });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (passcode: string) => {
    setError(null);
    try {
      const session = await apiLogin(passcode);
      if (session.authenticated) {
        setUser(session.user);
        setStatus("authenticated");
        return true;
      }
      setError("Sign-in did not complete.");
      return false;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* signed out locally regardless */ }
    setUser(null);
    setStatus("anonymous");
  }, []);

  const enterPreview = useCallback(() => setStatus("preview"), []);

  const value = useMemo<AuthState>(
    () => ({ status, user, required, error, login, logout, enterPreview }),
    [status, user, required, error, login, logout, enterPreview],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() needs an <AuthProvider> above it");
  return ctx;
}
