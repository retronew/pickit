// State and server calls behind the AI settings card.

import { useEffect, useState } from "react";
import { toastError, toastSuccess, api, errorMessage } from "#lib/api";
import {
  emptyAiSettings,
  normalizeBaseUrl,
  resolveEmbeddingEndpoint,
  type AiSettings,
} from "@pickit/shared";
import { hasUsableKey, emptyModels, postJson } from "./shared";
import type { Target, ModelInfo, AiSettingsResponse, ModelState, TestState } from "./shared";
import { m } from "#lib/i18n";

export function useAiSettings() {
  const [form, setForm] = useState<AiSettings>(emptyAiSettings);
  const [saved, setSaved] = useState<AiSettingsResponse | null>(null);
  const [models, setModels] = useState<Record<Target, ModelState>>({
    chat: emptyModels,
    embedding: emptyModels,
  });
  const [tests, setTests] = useState<Record<Target, TestState>>({
    chat: { running: false },
    embedding: { running: false },
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = () =>
    api<AiSettingsResponse>("/api/settings/ai")
      .then((d) => {
        setSaved(d);
        setLoadError("");
        const { apiKeyMasked: _c, ...chat } = d.chat;
        const { apiKeyMasked: _e, ...embedding } = d.embedding;
        setForm({ version: 2, chat, embedding });
      })
      .catch((err) => setLoadError(errorMessage(err)));

  useEffect(() => {
    load();
  }, []);


  const patchChat = (patch: Partial<AiSettings["chat"]>) =>
    setForm((f) => ({ ...f, chat: { ...f.chat, ...patch } }));
  const patchEmbedding = (patch: Partial<AiSettings["embedding"]>) =>
    setForm((f) => ({ ...f, embedding: { ...f.embedding, ...patch } }));

  const fetchModels = async (target: Target) => {
    if (!hasUsableKey(form[target], saved?.[target])) {
      setModels((prev) => ({
        ...prev,
        [target]: { models: [], loading: false, message: m.ai_need_key(), error: true },
      }));
      return;
    }
    setModels((prev) => ({ ...prev, [target]: { ...prev[target], loading: true, message: "" } }));
    const { ok, data } = await postJson<{ baseUrl?: string; models?: ModelInfo[]; error?: string }>(
      "/api/settings/ai/models",
      { target, settings: form },
    );
    if (!ok || !data.models || !data.baseUrl) {
      setModels((prev) => ({
        ...prev,
        [target]: { models: [], loading: false, message: data.error ?? m.ai_fetch_failed(), error: true },
      }));
      return;
    }
    // Model discovery may find the working route under /v1; adopt it.
    const current = normalizeBaseUrl(form[target].baseUrl);
    const adjusted = data.baseUrl !== current;
    if (adjusted) {
      if (target === "chat") patchChat({ baseUrl: data.baseUrl });
      else patchEmbedding({ baseUrl: data.baseUrl });
    }
    const wanted = data.models.filter((prev) => prev.kind === target).length;
    setModels((prev) => ({
      ...prev,
      [target]: {
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

  const runTest = async (target: Target) => {
    setTests((t) => ({ ...t, [target]: { running: true } }));
    const { data } = await postJson<{
      ok: boolean;
      error?: string;
      reply?: string;
      dimensions?: number;
    }>("/api/settings/ai/test", { target, settings: form });
    setTests((t) => ({
      ...t,
      [target]: {
        running: false,
        ok: data.ok,
        text: data.ok
          ? target === "chat"
            ? m.ai_test_chat_ok({ reply: data.reply || m.ai_empty_reply() })
            : m.ai_test_embedding_ok({ dimensions: String(data.dimensions) })
          : m.ai_test_failed({ error: String(data.error) }),
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

  const embeddingEndpoint = resolveEmbeddingEndpoint(form);

  return {
    form,
    saved,
    models,
    tests,
    saveMessage,
    loadError,
    load,
    setModels,
    patchChat,
    patchEmbedding,
    fetchModels,
    runTest,
    save,
    embeddingEndpoint,
  };
}
