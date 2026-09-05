/**
 * The user's book, as app state rather than a module constant.
 *
 * The first version of this app shipped a real person's holdings as bundled
 * constants that eight views imported directly. That is fine for a personal
 * dashboard and a blocker for anything public: every visitor saw that book.
 *
 * The book now starts empty, lives in a tiny external store, and persists in
 * localStorage on this device only. Views subscribe through `useBook()` and
 * re-render when it changes. The demo book (`demoBook.ts`) is loaded only on
 * request, and everything a user adds by hand lands here too, so the risk and
 * calendar views see it the same way they see a demo or a broker sync.
 */

import { useSyncExternalStore } from "react";

import * as DEMO from "@/data/demoBook";

export type Book = {
  IN_STOCKS: any[];
  US_STOCKS: any[];
  MUTUAL_FUNDS: any[];
  CRYPTO: any[];
  DIGITAL_METALS: any[];
};

export type BookSource = "empty" | "demo" | "manual" | "mixed";

const EMPTY: Book = {
  IN_STOCKS: [], US_STOCKS: [], MUTUAL_FUNDS: [], CRYPTO: [], DIGITAL_METALS: [],
};

const STORAGE_KEY = "tradepulse.book.v1";

type Stored = { book: Book; source: BookSource };

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed && parsed.book) return { book: { ...EMPTY, ...parsed.book }, source: parsed.source ?? "manual" };
    }
  } catch {
    // Private mode, disabled storage, or a corrupt entry: start empty.
  }
  return { book: EMPTY, source: "empty" };
}

let state: Stored = load();
const listeners = new Set<() => void>();

function commit(next: Stored) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do; the in-memory copy is still correct for this session.
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getBook = (): Book => state.book;
export const getBookSource = (): BookSource => state.source;

/** Subscribe a component to the book. Same identity until it changes. */
export function useBook(): Book & { source: BookSource; isEmpty: boolean } {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  const { book, source } = snapshot;
  const isEmpty = Object.values(book).every((rows) => rows.length === 0);
  return { ...book, source, isEmpty };
}

/** Every row across all segments, tagged the way the rest of the app expects. */
export function flattenBook(book: Book): any[] {
  return [
    ...book.IN_STOCKS, ...book.US_STOCKS, ...book.MUTUAL_FUNDS,
    ...book.CRYPTO, ...book.DIGITAL_METALS,
  ];
}

export function loadDemoBook(): void {
  commit({
    book: {
      IN_STOCKS: [...DEMO.IN_STOCKS],
      US_STOCKS: [...DEMO.US_STOCKS],
      MUTUAL_FUNDS: [...DEMO.MUTUAL_FUNDS],
      CRYPTO: [...DEMO.CRYPTO],
      DIGITAL_METALS: [...DEMO.DIGITAL_METALS],
    },
    source: "demo",
  });
}

export function clearBook(): void {
  commit({ book: EMPTY, source: "empty" });
}

const SEGMENT_KEY: Record<string, keyof Book> = {
  IN: "IN_STOCKS", US: "US_STOCKS", MF: "MUTUAL_FUNDS", CR: "CRYPTO", PM: "DIGITAL_METALS",
};

/** Add one holding the user typed in. Persists with the rest of the book. */
export function addToBook(holding: any): void {
  const key = SEGMENT_KEY[holding.segment] ?? "IN_STOCKS";
  const source: BookSource =
    state.source === "empty" ? "manual" : state.source === "demo" ? "mixed" : state.source;
  commit({
    book: { ...state.book, [key]: [...state.book[key], holding] },
    source,
  });
}
