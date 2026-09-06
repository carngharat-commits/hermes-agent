/* The signed-in user's own documents: the book and the watchlist. */

export type DocumentName = "book" | "watchlist";

export type Document<T> = { name: DocumentName; data: T | null; updated_at: number | null };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const getDocument = <T,>(name: DocumentName) => json<Document<T>>(`/api/me/${name}`);

export const putDocument = <T,>(name: DocumentName, data: T) =>
  json<Document<T>>(`/api/me/${name}`, { method: "PUT", body: JSON.stringify({ data }) });
