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

export function DuplicatesCard() {
  const [groups, setGroups] = useState<Item[][] | null>(null);
  const [keepChoice, setKeepChoice] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<number | null>(null);

  async function scan() {
    setLoading(true);
    try {
      const res = await fetch("/api/items/duplicates");
      const data: Item[][] = await res.json();
      setGroups(data);
      const initial: Record<number, number> = {};
      data.forEach((g, i) => {
        initial[i] = g[0].id;
      });
      setKeepChoice(initial);
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
      await fetch("/api/items/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeIds }),
      });
      setGroups((prev) => prev!.filter((_, i) => i !== groupIndex));
    } finally {
      setMerging(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>重复检测</CardTitle>
        <CardDescription>
          先按网址找出完全相同的收藏，再用 AI 发现内容相近的。
        </CardDescription>
      </CardHeader>
      {groups && (
        <CardContent className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">没有发现重复的收藏。</p>
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
                        {item.category || "未分类"}
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
                  保留这项，合并其余 {group.length - 1} 项
                </Button>
              </div>
            ))
          )}
        </CardContent>
      )}
      <CardFooter>
        <Button variant="outline" size="lg" loading={loading} onClick={scan}>
          {groups ? "重新检测" : "开始检测"}
        </Button>
      </CardFooter>
    </Card>
  );
}
