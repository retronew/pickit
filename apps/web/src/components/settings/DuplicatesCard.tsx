import { api, toastError, toastSuccess } from "#lib/api";
import { useState } from "react";
import type { Item } from "@pickit/shared";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import { RadioGroup, Radio } from "#components/ui/radio-group";
import { Favicon } from "#components/Favicon";
import { m } from "#lib/i18n";

export function DuplicatesCard() {
  const [groups, setGroups] = useState<Item[][] | null>(null);
  const [keepChoice, setKeepChoice] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<number | null>(null);

  async function scan() {
    setLoading(true);
    try {
      const data = await api<Item[][]>("/api/items/duplicates");
      setGroups(data);
      const initial: Record<number, number> = {};
      data.forEach((g, i) => {
        initial[i] = g[0].id;
      });
      setKeepChoice(initial);
      if (data.length) toastSuccess(m.dups_found({ count: data.length }), { id: "duplicates" });
      else toastSuccess(m.dups_none(), { id: "duplicates" });
    } catch (err) {
      toastError(m.dups_scan_failed(), err, { id: "duplicates" });
    } finally {
      setLoading(false);
    }
  }

  async function merge(groupIndex: number) {
    const group = groups![groupIndex];
    const keepId = keepChoice[groupIndex];
    const removeIds = group.map((i) => i.id).filter((id) => id !== keepId);
    setMerging(groupIndex);
    try {
      await api("/api/items/merge", { json: { keepId, removeIds } });
      setGroups((prev) => prev!.filter((_, i) => i !== groupIndex));
      toastSuccess(m.dups_merged(), {
        description: m.dups_merged_detail({ name: group.find((i) => i.id === keepId)?.name ?? "", count: removeIds.length }),
        id: "merge",
      });
    } catch (err) {
      toastError(m.dups_merge_failed(), err, { id: "merge" });
    } finally {
      setMerging(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.dups_title()}</CardTitle>
        <CardDescription>
          {m.dups_description()}
        </CardDescription>
      </CardHeader>
      {groups && (
        <CardContent className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">{m.dups_none()}</p>
          ) : (
            groups.map((group, gi) => (
              <div key={gi} className="space-y-3 rounded-lg border p-3">
                <RadioGroup
                  value={String(keepChoice[gi])}
                  onValueChange={(v) =>
                    setKeepChoice((prev) => ({ ...prev, [gi]: Number(v) }))
                  }
                  className="gap-2"
                >
                  {group.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Radio value={String(item.id)} />
                      <Favicon url={item.url} name={item.name} />
                      <span className="truncate">{item.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.category || m.uncategorized()}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
                <Button
                  size="sm"
                  variant="outline"
                  loading={merging === gi}
                  onClick={() => merge(gi)}
                >
                  {m.dups_keep({ count: group.length - 1 })}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      )}
      <CardFooter>
        <Button variant="outline" size="lg" loading={loading} onClick={scan}>
          {groups ? m.dups_rescan() : m.dups_scan()}
        </Button>
      </CardFooter>
    </Card>
  );
}
