// State and server calls behind the AI settings card.

import { useEffect, useState } from "react";
import { toastError, toastSuccess, api, errorMessage } from "#lib/api";
import {
  chatEndpoints,
  emptyAiSettings,
  emptyChatEndpoint,
  normalizeBaseUrl,
  resolveEmbeddingEndpoint,
  withChatEndpoints,
  type AiSettings,
  type ChatEndpoint,
  type ChatTestReport,
} from "@pickit/shared";
import { hasUsableKey, emptyModels, originOf, postJson } from "./shared";
import type { Target, ModelInfo, AiSettingsResponse, ModelState, TestState, SavedEndpoint } from "./shared";
import { m } from "#lib/i18n";

/** Models and tests are tracked per chat endpoint id, plus one "embedding" slot. */
const EMBEDDING = "embedding";
const idleTest: TestState = { running: false };

export function useAiSettings() {
  const [form, setForm] = useState<AiSettings>(emptyAiSettings);
  const [saved, setSaved] = useState<AiSettingsResponse | null>(null);
  const [models, setModels] = useState<Record<string, ModelState>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [selectedChatId, setSelectedChatId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = () =>
    api<AiSettingsResponse>("/api/settings/ai")
      .then((d) => {
        setSaved(d);
        setLoadError("");
        const strip = <T extends { apiKeyMasked: string }>({ apiKeyMasked: _, ...rest }: T) => rest;
        const next = { version: 2 as const, chat: strip(d.chat), chatFallbacks: d.chatFallbacks.map(strip), embedding: strip(d.embedding) };
        setForm(next);
        setSelectedChatId((id) => (chatEndpoints(next).some((e) => e.id === id) ? id : next.chat.id));
      })
      .catch((err) => setLoadError(errorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  const chats = chatEndpoints(form);
  const selectedIndex = Math.max(0, chats.findIndex((e) => e.id === selectedChatId));
  const selectedChat = chats[selectedIndex];
  const savedChats = saved ? [saved.chat, ...saved.chatFallbacks] : [];
  /** The saved endpoint whose key an edited one can reuse (same id, as the API matches). */
  const savedChatFor = (e: ChatEndpoint): SavedEndpoint | undefined =>
    savedChats.find((s) => s.id === e.id) ??
    savedChats.find((s) => s.provider === e.provider && originOf(s.baseUrl) === originOf(e.baseUrl));

  const setChats = (list: ChatEndpoint[]) => setForm((f) => withChatEndpoints(f, list));
  const patchChat = (id: string, patch: Partial<ChatEndpoint>) =>
    setForm((f) => withChatEndpoints(f, chatEndpoints(f).map((e) => (e.id === id ? { ...e, ...patch } : e))));
  const addChat = () => {
    const e = emptyChatEndpoint();
    setChats([...chats, e]);
    setSelectedChatId(e.id);
  };
  const removeChat = (id: string) => {
    const rest = chats.filter((e) => e.id !== id);
    if (!rest.length) return;
    setChats(rest);
    if (id === selectedChat.id) setSelectedChatId(rest[0].id);
  };
  const patchEmbedding = (patch: Partial<AiSettings["embedding"]>) =>
    setForm((f) => ({ ...f, embedding: { ...f.embedding, ...patch } }));
  const resetModels = (key: string) => setModels((prev) => ({ ...prev, [key]: emptyModels }));

  /** `key` is a chat endpoint id or "embedding". */
  const fetchModels = async (key: string) => {
    const target: Target = key === EMBEDDING ? "embedding" : "chat";
    const index = chats.findIndex((e) => e.id === key);
    const endpoint = target === "chat" ? chats[index] : form.embedding;
    const savedEndpoint = target === "chat" ? savedChatFor(chats[index]) : saved?.embedding;
    if (!hasUsableKey(endpoint, savedEndpoint)) {
      setModels((prev) => ({ ...prev, [key]: { models: [], loading: false, message: m.ai_need_key(), error: true } }));
      return;
    }
    setModels((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyModels), loading: true, message: "" } }));
    const { ok, data } = await postJson<{ baseUrl?: string; models?: ModelInfo[]; error?: string }>(
      "/api/settings/ai/models",
      { target, index, settings: form },
    );
    if (!ok || !data.models || !data.baseUrl) {
      setModels((prev) => ({
        ...prev,
        [key]: { models: [], loading: false, message: data.error ?? m.ai_fetch_failed(), error: true },
      }));
      return;
    }
    // Model discovery may find the working route under /v1; adopt it.
    const adjusted = data.baseUrl !== normalizeBaseUrl(endpoint.baseUrl);
    if (adjusted) {
      if (target === "chat") patchChat(key, { baseUrl: data.baseUrl });
      else patchEmbedding({ baseUrl: data.baseUrl });
    }
    const wanted = data.models.filter((prev) => prev.kind === target).length;
    setModels((prev) => ({
      ...prev,
      [key]: {
        models: data.models!,
        loading: false,
        error: false,
        message:
          m.ai_models_found({ count: data.models!.length }) +
          (wanted
            ? target === "chat"
              ? m.ai_models_found_chat({ count: wanted })
              : m.ai_models_found_embedding({ count: wanted })
            : "") +
          (adjusted ? m.ai_base_url_adjusted({ url: data.baseUrl! }) : ""),
      },
    }));
  };

  const runTest = async (key: string) => {
    const target: Target = key === EMBEDDING ? "embedding" : "chat";
    const index = chats.findIndex((e) => e.id === key);
    setTests((t) => ({ ...t, [key]: { running: true } }));
    const { data } = await postJson<
      Partial<ChatTestReport> & { ok: boolean; error?: string; dimensions?: number; durationMs?: number }
    >("/api/settings/ai/test", { target, index, settings: form });
    setTests((t) => ({
      ...t,
      [key]: {
        running: false,
        ok: data.ok,
        text: data.ok
          ? target === "chat"
            ? m.ai_test_chat_ok({ reply: data.reply || m.ai_empty_reply() })
            : m.ai_test_embedding_ok({ dimensions: String(data.dimensions) })
          : m.ai_test_failed({ error: String(data.error) }),
        durationMs: data.durationMs,
        report: data.ok && target === "chat" ? (data as ChatTestReport) : undefined,
      },
    }));
  };

  const save = async () => {
    const { ok, data } = await postJson<{
      chatConfigured: boolean;
      embeddingConfigured: boolean;
    }>("/api/settings/ai", form);
    if (!ok) {
      setSaveMessage(m.ai_save_failed_retry());
      toastError(m.ai_save_failed(), undefined, { id: "ai-save" });
      return;
    }
    toastSuccess(m.ai_saved(), { id: "ai-save" });
    setSaveMessage(
      m.ai_saved_status({
        chat: data.chatConfigured ? m.ai_available() : m.ai_not_configured(),
        embedding: data.embeddingConfigured ? m.ai_available() : m.ai_not_configured(),
      }),
    );
    await load();
  };

  return {
    form,
    saved,
    saveMessage,
    loadError,
    load,
    save,
    chats: {
      list: chats,
      selected: selectedChat,
      selectedIndex,
      select: setSelectedChatId,
      reorder: setChats,
      add: addChat,
      remove: removeChat,
      patch: (patch: Partial<ChatEndpoint>) => patchChat(selectedChat.id, patch),
      savedFor: savedChatFor,
      models: models[selectedChat.id] ?? emptyModels,
      test: tests[selectedChat.id] ?? idleTest,
      resetModels: () => resetModels(selectedChat.id),
      fetchModels: () => fetchModels(selectedChat.id),
      runTest: () => runTest(selectedChat.id),
    },
    embedding: {
      endpoint: form.embedding,
      resolved: resolveEmbeddingEndpoint(form),
      patch: patchEmbedding,
      models: models[EMBEDDING] ?? emptyModels,
      test: tests[EMBEDDING] ?? idleTest,
      resetModels: () => resetModels(EMBEDDING),
      fetchModels: () => fetchModels(EMBEDDING),
      runTest: () => runTest(EMBEDDING),
    },
  };
}

export type ChatEndpointsState = ReturnType<typeof useAiSettings>["chats"];
export type EmbeddingState = ReturnType<typeof useAiSettings>["embedding"];
