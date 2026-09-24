import { useEffect, useRef, useState } from "react";
import { sortText } from "#lib/collate";
import { useNavigate, useSearchParams } from "react-router";
import { uniq } from "es-toolkit";
import type { Item } from "@pickit/shared";
import { ItemFormDialog, type ItemFormPayload } from "#components/items/ItemFormDialog";
import { saveItem } from "#lib/items";
import { Confirm } from "#components/Confirm";
import { Spinner } from "#components/ui/spinner";
import { m } from "#lib/i18n";

export function AddPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<string>(m.add_recognizing());

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
      const categories = sortText(uniq(items.map((i) => i.category).filter(Boolean)));
      const allTags = sortText(uniq(items.flatMap((i) => i.tags)));

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
              image: data.image || "",
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
      await ItemFormDialog.call({
        item: null,
        categories,
        allTags,
        initial,
        onSubmit: (p) => saveItem(p, null),
      });
      navigate("/");
    })();
  }, [params, navigate]);

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
