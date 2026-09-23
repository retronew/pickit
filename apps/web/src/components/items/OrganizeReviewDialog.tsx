import { useEffect, useMemo, useState } from "react";
import { createCallable } from "react-call";
import { ArrowRightIcon } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Button } from "#components/ui/button";
import { Badge } from "#components/ui/badge";
import { Checkbox } from "#components/ui/checkbox";
import { Progress } from "#components/ui/progress";
import { Skeleton } from "#components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "#components/ui/table";
import {
  useOrganizeSuggestions,
  isChange,
  sameTags,
  MAX_REVIEW,
  type SuggestionRow,
} from "#hooks/useOrganizeSuggestions";
import { api, toastError } from "#lib/api";
import { cn } from "#lib/utils";

function Tags({ tags, muted }: { tags: string[]; muted?: boolean }) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t} variant={muted ? "outline" : "secondary"} size="sm">
          {t}
        </Badge>
      ))}
    </span>
  );
}

function Change({ from, to, changed }: { from: React.ReactNode; to: React.ReactNode; changed: boolean }) {
  if (!changed) return <span className="text-muted-foreground">{from}</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground line-through decoration-muted-foreground/50">{from}</span>
      <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="font-medium">{to}</span>
    </span>
  );
}

function Row({ row, checked, onCheck }: { row: SuggestionRow; checked: boolean; onCheck: (v: boolean) => void }) {
  const s = row.suggested;
  const changes = isChange(row);
  return (
    <TableRow className={cn("animate-fade-in", !changes && "opacity-60")}>
      <TableCell className="w-8">
        <Checkbox checked={checked} disabled={!changes} onCheckedChange={(v) => onCheck(!!v)} aria-label={row.name} />
      </TableCell>
      <TableCell className="max-w-48 truncate font-medium" title={row.url}>
        {row.name}
      </TableCell>
      {row.error ? (
        <TableCell colSpan={2} className="text-destructive text-xs">
          {row.error}
        </TableCell>
      ) : (
        <>
          <TableCell>
            <Change
              from={row.category || "未分类"}
              to={s!.category || "未分类"}
              changed={s!.category !== row.category}
            />
          </TableCell>
          <TableCell>
            <Change
              from={<Tags tags={row.tags} muted />}
              to={<Tags tags={s!.tags} />}
              changed={!sameTags(s!.tags, row.tags)}
            />
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

/** AI suggestions for the selection, reviewed row by row before applying. */
export const OrganizeReviewDialog = createCallable<{ ids: number[] }, number | null>(({ ids, call }) => {
  const [entered, setEntered] = useState(false);
  const { rows, loaded, total, error, done } = useOrganizeSuggestions(ids);
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const changeable = useMemo(() => rows.filter(isChange), [rows]);
  const selected = changeable.filter((r) => !unchecked.has(r.id));
  const allChecked = changeable.length > 0 && selected.length === changeable.length;

  function toggle(id: number, on: boolean) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    setApplying(true);
    try {
      await api("/api/items/bulk", {
        json: {
          action: "apply",
          updates: selected.map((r) => ({ id: r.id, category: r.suggested!.category, tags: r.suggested!.tags })),
        },
      });
      call.end(selected.length);
    } catch (err) {
      toastError("应用失败", err, { id: "organize-apply" });
      setApplying(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && !applying && call.end(null)}>
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>AI 整理建议</DialogTitle>
          <DialogDescription>
            勾选要采纳的建议，没有变化的条目会自动跳过。
            {ids.length > MAX_REVIEW && `一次最多处理 ${MAX_REVIEW} 项，这次只看前 ${MAX_REVIEW} 项。`}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {!done && (
            <div className="space-y-1.5">
              <Progress value={(loaded / total) * 100} />
              <p className="text-muted-foreground text-xs tabular-nums">
                正在生成建议 {loaded}/{total}…
              </p>
            </div>
          )}
          {error && <p className="text-destructive text-sm">生成建议失败：{error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={selected.length > 0 && !allChecked}
                    disabled={changeable.length === 0}
                    onCheckedChange={(v) => setUnchecked(v ? new Set() : new Set(changeable.map((r) => r.id)))}
                    aria-label="全选"
                  />
                </TableHead>
                <TableHead>名称</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>标签</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <Row key={r.id} row={r} checked={isChange(r) && !unchecked.has(r.id)} onCheck={(v) => toggle(r.id, v)} />
              ))}
              {!done &&
                Array.from({ length: Math.min(3, total - loaded) }, (_, i) => (
                  <TableRow key={`s${i}`}>
                    {["w-4", "w-32", "w-24", "w-36"].map((w, j) => (
                      <TableCell key={j}>
                        <Skeleton className={cn("h-4", w)} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {done && rows.length > 0 && changeable.length === 0 && (
            <p className="text-muted-foreground text-sm">AI 觉得这些收藏的分类和标签都不用改。</p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" disabled={applying} onClick={() => call.end(null)}>
            取消
          </Button>
          <Button disabled={selected.length === 0 || applying} loading={applying} onClick={apply}>
            应用 {selected.length} 项
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
