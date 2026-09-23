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
      setModels((m) => ({
        ...m,
        [target]: { models: [], loading: false, message: "请先填写 API 密钥，再获取模型列表", error: true },
      }));
      return;
    }
    setModels((m) => ({ ...m, [target]: { ...m[target], loading: true, message: "" } }));
    const { ok, data } = await postJson<{ baseUrl?: string; models?: ModelInfo[]; error?: string }>(
      "/api/settings/ai/models",
      { target, settings: form },
    );
    if (!ok || !data.models || !data.baseUrl) {
      setModels((m) => ({
        ...m,
        [target]: { models: [], loading: false, message: data.error ?? "获取失败", error: true },
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
    const wanted = data.models.filter((m) => m.kind === target).length;
    setModels((m) => ({
      ...m,
      [target]: {
        models: data.models!,
        loading: false,
        error: false,
        message:
          `找到 ${data.models!.length} 个模型` +
          (wanted ? `（其中 ${wanted} 个${target === "chat" ? "对话" : "向量"}模型）` : "") +
          (adjusted ? `，接口地址已自动改为 ${data.baseUrl}` : ""),
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
            ? `连接成功，模型回复：${data.reply || "（空）"}`
            : `连接成功，向量维度 ${data.dimensions}`
          : `连接失败：${data.error}`,
      },
    }));
  };

  const save = async () => {
    const { ok, data } = await postJson<{
      chatConfigured: boolean;
      embeddingConfigured: boolean;
    }>("/api/settings/ai", form);
    if (!ok) {
      setSaveMessage("保存失败，请重试");
      toastError("保存 AI 配置失败", undefined, { id: "ai-save" });
      return;
    }
    toastSuccess("AI 配置已保存", { id: "ai-save" });
    setSaveMessage(
      `已保存 · 对话模型${data.chatConfigured ? "可用" : "未配置"} · 向量模型${data.embeddingConfigured ? "可用" : "未配置"}`,
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
