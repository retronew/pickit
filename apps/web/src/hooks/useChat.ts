import { useEffect, useState } from "react";
import type { Item } from "@pickit/shared";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "pickit-chat-messages";

function loadStoredMessages(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMsg[]) : [];
  } catch {
    return [];
  }
}

export function extractRefIds(content: string): number[] {
  return [...content.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
}

export function renderableText(content: string, cache: Record<number, Item>): string {
  return content.replace(/\[\[(\d+)\]\]/g, (_, id) => {
    const item = cache[Number(id)];
    return item ? `**${item.name}**` : "";
  });
}

async function fetchItems(ids: number[]): Promise<(Item | null)[]> {
  return Promise.all(
    ids.map((id) =>
      fetch(`/api/items/${id}`)
        .then((r) => (r.ok ? (r.json() as Promise<Item>) : null))
        .catch(() => null),
    ),
  );
}

/**
 * AI chat state: messages (persisted in localStorage), streaming replies and
 * the items the replies cite as [[id]]. `onChunk` runs after each streamed chunk.
 */
export function useChat(onChunk?: () => void) {
  const [messages, setMessages] = useState<ChatMsg[]>(loadStoredMessages);
  const [streaming, setStreaming] = useState(false);
  const [itemCache, setItemCache] = useState<Record<number, Item>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage unavailable (private mode, quota, etc.) — chat still works
    }
  }, [messages]);

  async function loadRefItems(ids: number[]) {
    const missing = [...new Set(ids)].filter((id) => !itemCache[id]);
    if (missing.length === 0) return;
    const fetched = await fetchItems(missing);
    setItemCache((prev) => {
      const next = { ...prev };
      fetched.forEach((item, i) => {
        if (item) next[missing[i]] = item;
      });
      return next;
    });
  }

  useEffect(() => {
    // Only for the messages restored from localStorage on first mount —
    // messages sent afterwards resolve their refs at the end of send().
    const ids = messages.flatMap((m) => (m.role === "assistant" ? extractRefIds(m.content) : []));
    if (ids.length > 0) loadRefItems(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setLastReply(content: string) {
    setMessages((m) => [...m.slice(0, -1), { role: "assistant", content }]);
  }

  async function send(text: string) {
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLastReply(data.error ?? "请求失败，请稍后重试");
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLastReply(acc);
        onChunk?.();
      }
      await loadRefItems(extractRefIds(acc));
    } catch {
      setLastReply("网络出问题了，请重试");
    } finally {
      setStreaming(false);
    }
  }

  return { messages, clear: () => setMessages([]), streaming, itemCache, send };
}
