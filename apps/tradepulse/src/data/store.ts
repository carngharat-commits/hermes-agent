/**
 * A tiny persisted store: in memory, mirrored to localStorage, and — once
 * signed in — mirrored to the server as the user's own document.
 *
 * Both the book and the watchlist use it. The rules, in order:
 *   1. On sign-in, the server's copy wins when it has one.
 *   2. If the server has none and this browser does, the browser's copy is
 *      pushed up once — the migration for browsers that predate accounts.
 *   3. Every later change is pushed, debounced.
 *   4. On sign-out the local copy is cleared, so the next person on a shared
 *      device does not inherit the last person's book.
 * In read-only preview (no backend) it behaves as it always did: local only.
 */

import { useSyncExternalStore } from "react";

import { getDocument, putDocument, type DocumentName } from "@/api/me";

export class PersistedStore<T> {
  private listeners = new Set<() => void>();
  private state: T;
  private syncing = false;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  /** "local" until the server has been consulted; then "server". */
  origin: "local" | "server" = "local";

  private readonly name: DocumentName;
  private readonly storageKey: string;
  private readonly empty: () => T;
  private readonly isEmpty: (v: T) => boolean;

  constructor(name: DocumentName, storageKey: string, empty: () => T, isEmpty: (v: T) => boolean) {
    this.name = name;
    this.storageKey = storageKey;
    this.empty = empty;
    this.isEmpty = isEmpty;
    this.state = this.load();
  }

  private load(): T {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return { ...this.empty(), ...JSON.parse(raw) } as T;
    } catch { /* private mode, disabled storage, or a corrupt entry */ }
    return this.empty();
  }

  get = (): T => this.state;

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };

  /** Replace the state. `fromServer` skips the push-back and the local write is kept as a cache. */
  set(next: T, { fromServer = false } = {}): void {
    this.state = next;
    try { localStorage.setItem(this.storageKey, JSON.stringify(next)); } catch { /* still correct in memory */ }
    this.listeners.forEach((fn) => fn());
    if (!fromServer && this.syncing) this.schedulePush();
  }

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      putDocument(this.name, this.state).catch(() => { /* retried on the next change */ });
    }, 400);
  }

  /** Called once the backend says this browser is signed in. */
  async startSync(): Promise<void> {
    this.syncing = true;
    try {
      const doc = await getDocument<T>(this.name);
      if (doc.data !== null && doc.data !== undefined) {
        this.origin = "server";
        this.set({ ...this.empty(), ...doc.data } as T, { fromServer: true });
      } else if (!this.isEmpty(this.state)) {
        await putDocument(this.name, this.state);        // migrate this browser's copy
        this.origin = "server";
      } else {
        this.origin = "server";
      }
    } catch {
      // Unreachable or unauthorised: stay local; nothing is lost.
    }
  }

  /** Called on sign-out. Local copy goes with the session. */
  stopSyncAndClear(): void {
    this.syncing = false;
    this.origin = "local";
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.set(this.empty(), { fromServer: true });
    try { localStorage.removeItem(this.storageKey); } catch { /* fine */ }
  }
}

export function useStore<T>(store: PersistedStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
