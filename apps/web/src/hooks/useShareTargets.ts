import { useEffect, useState } from "react";
import { api } from "#lib/api";

/** Categories and tags to pick from when creating a share from scratch. */
export function useShareTargets(enabled: boolean) {
  const [categories, setCategories] = useState<string[] | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api<string[]>("/api/items/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
    api<{ tag: string }[]>("/api/tags")
      .then((rows) => setTags(rows.map((r) => r.tag)))
      .catch(() => setTags([]));
  }, [enabled]);

  return { categories, tags };
}
