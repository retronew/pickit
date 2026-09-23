import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { uniq } from "es-toolkit";
import type { Item } from "@pickit/shared";
import { ItemFormDialog, type ItemFormPayload } from "#components/ItemFormDialog";
import { Confirm } from "#components/Confirm";
import { Spinner } from "#components/ui/spinner";

export function AddPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState("正在识别这个链接…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const title = params.get("title") ?? "";
    // Web Share Target: some apps only fill `text` (sometimes with a
    // trailing description) rather than `url`, so fall back to extracting
    // a URL out of it.
    const rawUrl = params.get("url") ?? "";
    const text = params.get("text") ?? "";
    const url = rawUrl || (text.match(/https?:\/\/\S+/)?.[0] ?? "");

    (async () => {
      const items: Item[] = await fetch("/api/items").then((r) => r.json());
      const categories = uniq(items.map((i) => i.category).filter(Boolean)).sort();
      const allTags = uniq(items.flatMap((i) => i.tags)).sort();

      let initial: Partial<ItemFormPayload> = { url, name: title };
      if (/^https?:\/\//.test(url)) {
        try {
          const res = await fetch("/api/items/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (res.ok) {
            const data = await res.json();
            initial = {
              name: data.name || title,
              url,
              icon: data.icon || "",
              note: data.note || "",
              category: data.category || "",
              tags: data.tags ?? [],
            };
          }
        } catch {
          // AI unavailable, fall back to bare url/title
        }
      }

      setStatus("");
      const payload = await ItemFormDialog.call({
        item: null,
        categories,
        allTags,
        initial,
      });
      if (payload) await save(payload);
      navigate("/");
    })();
  }, [params, navigate]);

  async function save(payload: ItemFormPayload) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const data = await res.json();
      const ok = await Confirm.call({
        title: "这条收藏已经存在",
        message: `「${data.existing?.name ?? "这条收藏"}」已经在你收藏里了，还要再存一条吗？`,
        confirmLabel: "继续保存",
      });
      if (!ok) return;
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, allowDuplicate: true }),
      });
    }
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      {status && (
        <>
          <Spinner />
          <p className="text-muted-foreground text-sm">{status}</p>
        </>
      )}
      <ItemFormDialog />
      <Confirm />
    </div>
  );
}
