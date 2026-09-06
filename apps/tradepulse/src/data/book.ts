/**
 * The user's book, as app state rather than a module constant.
 *
 * The first version of this app shipped a real person's holdings as bundled
 * constants that eight views imported directly. That is fine for a personal
 * dashboard and a blocker for anything public: every visitor saw that book.
 *
 * The book starts empty and lives in a `PersistedStore`: mirrored to this
 * browser, and once signed in, to the server as the user's own document, so
 * a second device sees the same book and a shared device does not leak it.
 * The demo book (`demoBook.ts`) is loaded only on request, and everything a
 * user adds by hand lands here too, so the risk and calendar views see it the
 * same way they see a demo or a broker sync.
 */

import * as DEMO from "@/data/demoBook";
import { PersistedStore, useStore } from "@/data/store";

export type Book = {
  IN_STOCKS: any[];
  US_STOCKS: any[];
  MUTUAL_FUNDS: any[];
  CRYPTO: any[];
  DIGITAL_METALS: any[];
};

export type BookSource = "empty" | "demo" | "manual" | "mixed";

type Stored = { book: Book; source: BookSource };

const EMPTY_BOOK: Book = {
  IN_STOCKS: [], US_STOCKS: [], MUTUAL_FUNDS: [], CRYPTO: [], DIGITAL_METALS: [],
};

export const bookStore = new PersistedStore<Stored>(
  "book",
  "tradepulse.book.v1",
  () => ({ book: EMPTY_BOOK, source: "empty" }),
  (s) => Object.values(s.book).every((rows) => rows.length === 0),
);

export const getBook = (): Book => bookStore.get().book;
export const getBookSource = (): BookSource => bookStore.get().source;

/** Subscribe a component to the book. Same identity until it changes. */
export function useBook(): Book & { source: BookSource; isEmpty: boolean } {
  const { book, source } = useStore(bookStore);
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

const tagDemo = (rows: any[]) => rows.map((r) => ({ ...r, demo: true }));
const ownRows = (rows: any[]) => rows.filter((r) => !r.demo);

/** Load the sample book on top of whatever the user has entered. */
export function loadDemoBook(): void {
  const { book } = bookStore.get();
  const own = {
    IN_STOCKS: ownRows(book.IN_STOCKS), US_STOCKS: ownRows(book.US_STOCKS),
    MUTUAL_FUNDS: ownRows(book.MUTUAL_FUNDS), CRYPTO: ownRows(book.CRYPTO),
    DIGITAL_METALS: ownRows(book.DIGITAL_METALS),
  };
  const hasOwn = Object.values(own).some((rows) => rows.length > 0);
  bookStore.set({
    book: {
      IN_STOCKS: [...tagDemo(DEMO.IN_STOCKS), ...own.IN_STOCKS],
      US_STOCKS: [...tagDemo(DEMO.US_STOCKS), ...own.US_STOCKS],
      MUTUAL_FUNDS: [...tagDemo(DEMO.MUTUAL_FUNDS), ...own.MUTUAL_FUNDS],
      CRYPTO: [...tagDemo(DEMO.CRYPTO), ...own.CRYPTO],
      DIGITAL_METALS: [...tagDemo(DEMO.DIGITAL_METALS), ...own.DIGITAL_METALS],
    },
    source: hasOwn ? "mixed" : "demo",
  });
}

/**
 * Remove the sample rows and only the sample rows.
 *
 * The first version cleared the whole book, which threw away holdings the
 * user had typed in on top of the demo. Demo rows carry a `demo` flag from
 * the moment they are loaded, so they can be taken out on their own.
 */
export function clearDemo(): void {
  const { book } = bookStore.get();
  const own: Book = {
    IN_STOCKS: ownRows(book.IN_STOCKS), US_STOCKS: ownRows(book.US_STOCKS),
    MUTUAL_FUNDS: ownRows(book.MUTUAL_FUNDS), CRYPTO: ownRows(book.CRYPTO),
    DIGITAL_METALS: ownRows(book.DIGITAL_METALS),
  };
  const hasOwn = Object.values(own).some((rows) => rows.length > 0);
  bookStore.set({ book: own, source: hasOwn ? "manual" : "empty" });
}

/** Empty the book entirely. Tests and sign-out; the UI offers `clearDemo`. */
export function clearBook(): void {
  bookStore.set({ book: EMPTY_BOOK, source: "empty" });
}

const SEGMENT_KEY: Record<string, keyof Book> = {
  IN: "IN_STOCKS", US: "US_STOCKS", MF: "MUTUAL_FUNDS", CR: "CRYPTO", PM: "DIGITAL_METALS",
};

/** Add one holding the user typed in. Persists with the rest of the book. */
export function addToBook(holding: any): void {
  const { book, source: current } = bookStore.get();
  const key = SEGMENT_KEY[holding.segment] ?? "IN_STOCKS";
  const source: BookSource =
    current === "empty" ? "manual" : current === "demo" ? "mixed" : current;
  bookStore.set({ book: { ...book, [key]: [...book[key], holding] }, source });
}
