import { useNavigate } from "react-router";
import { Card } from "#components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { CategoryPickerDialog } from "#components/categories/CategoryPickerDialog";
import { CategoryRow } from "#components/categories/CategoryRow";
import { Confirm } from "#components/Confirm";
import { PageLoading } from "#components/PageLoading";
import { Prompt } from "#components/Prompt";
import { ShareDialog } from "#components/shares/ShareDialog";
import { useCategories } from "#hooks/useCategories";
import { m } from "#lib/i18n";

export function CategoriesPage() {
  const { nodes, rename, moveTo, mergeInto, remove } = useCategories();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <h1 className="font-heading font-semibold text-lg">{m.nav_categories()}</h1>

      {nodes === null ? (
        <PageLoading />
      ) : nodes.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.categories_empty()}</EmptyTitle>
            <EmptyDescription>{m.categories_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="animate-fade-in gap-0 p-2">
          {nodes.map((node) => (
            <CategoryRow
              key={node.category}
              node={node}
              onOpen={() => navigate(`/?category=${encodeURIComponent(node.category)}`)}
              onShare={() => ShareDialog.call({ target: { type: "category", value: node.category } })}
              onRename={() => rename(node)}
              onMove={() => moveTo(node)}
              onMerge={() => mergeInto(node)}
              onDelete={() => remove(node)}
            />
          ))}
        </Card>
      )}

      <CategoryPickerDialog />
      <Confirm />
      <Prompt />
      <ShareDialog />
    </div>
  );
}
