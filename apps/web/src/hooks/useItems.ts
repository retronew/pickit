import { useCallback, useEffect, useState } from "react";
import type { Item } from "@pickit/shared";

export type { Item };

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      fetch("/api/items")
        .then((r) => r.json())
        .then(setItems)
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
