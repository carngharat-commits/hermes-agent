/**
 * The auth context and its hook, apart from the provider so that the file
 * with the component exports only a component (fast refresh needs that).
 */

import { createContext, useContext } from "react";

import type { AuthUser, Credentials, NewAccount } from "@/api/auth";

export type AuthStatus =
  | "checking"        // first request in flight
  | "setup"           // backend answered: no accounts yet — create the first
  | "anonymous"       // backend answered: sign in
  | "authenticated"   // backend answered: in
  | "unreachable"     // no backend (network error) — offer the preview
  | "preview";        // user chose to look around without a backend

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  required: boolean;
  error: string | null;
  login: (credentials: Credentials) => Promise<boolean>;
  setup: (account: NewAccount) => Promise<boolean>;
  logout: () => Promise<void>;
  enterPreview: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "TP";

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() needs an <AuthProvider> above it");
  return ctx;
}
