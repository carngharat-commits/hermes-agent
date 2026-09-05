/* Client for the AI chat drawer. The model call happens on the backend, so
   no key is ever in this bundle; the browser sends only the conversation. */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatReply = {
  configured: boolean;
  reply: string | null;
  model: string | null;
  /** Why there is no reply: unconfigured server, a decline, a bad request. */
  reason: string | null;
  served_by: string | null;
};

export type AIStatus = { configured: boolean; model: string | null };

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

export const getAIStatus = () => json<AIStatus>("/api/ai/status");

export const chat = (context: string, messages: ChatTurn[]) =>
  json<ChatReply>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ context, messages }),
  });
