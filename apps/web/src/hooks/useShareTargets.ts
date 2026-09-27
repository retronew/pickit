import { useQuery } from "@tanstack/react-query";
import { itemCategoryNamesQuery, tagsQuery } from "#lib/queries";

/** Categories and tags to pick from when creating a share from scratch. */
export function useShareTargets(enabled: boolean) {
  const categories = useQuery({ ...itemCategoryNamesQuery, enabled });
  const tags = useQuery({ ...tagsQuery, enabled });

  return {
    categories: categories.data ?? (categories.isError ? [] : null),
    tags: tags.data ? tags.data.map((r) => r.tag) : tags.isError ? [] : null,
  };
}
