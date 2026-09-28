import { useState } from "react";

/**
 * Suggestions for a free-text Autocomplete: the full list when the popup
 * opens, filtered only once the user edits the input. Otherwise a value that
 * matches a suggestion filters the list down to itself.
 */
export function useSuggestionFilter(items: string[], value: string) {
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const query = value.trim().toLowerCase();
  const filteredItems =
    openedWith === value || !query ? items : items.filter((item) => item.toLowerCase().includes(query));
  return {
    filteredItems,
    onOpenChange: (open: boolean) => setOpenedWith(open ? value : null),
  };
}
