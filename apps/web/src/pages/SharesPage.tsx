import { PlusIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { ListSkeleton } from "#components/settings/skeletons";
import { Confirm } from "#components/Confirm";
import { Prompt } from "#components/Prompt";
import { ShareDialog } from "#components/shares/ShareDialog";
import { ShareRow } from "#components/shares/ShareRow";
import { ShareStatsDialog } from "#components/shares/ShareStatsDialog";
import { useShares } from "#hooks/useShares";
import { m } from "#lib/i18n";

export function SharesPage() {
  const { shares, create, rename, remove } = useShares();
  const totalViews = shares?.reduce((sum, s) => sum + s.viewCount, 0) ?? 0;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading font-semibold text-lg">{m.nav_shares()}</h1>
        <Button onClick={create}>
          <PlusIcon />
          {m.shares_new()}
        </Button>
      </div>

      {shares && shares.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {m.shares_summary({ count: shares.length, views: totalViews })}
        </p>
      )}

      {shares === null ? (
        <ListSkeleton rows={3} />
      ) : shares.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>{m.shares_none()}</EmptyTitle>
            <EmptyDescription>{m.shares_none_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 p-2">
          {shares.map((s) => (
            <ShareRow
              key={s.slug}
              share={s}
              onStats={() => ShareStatsDialog.call({ slug: s.slug, title: s.title || s.value })}
              onRename={() => rename(s)}
              onRevoke={() => remove(s)}
            />
          ))}
        </Card>
      )}

      <ShareDialog />
      <ShareStatsDialog />
      <Prompt />
      <Confirm />
    </div>
  );
}
