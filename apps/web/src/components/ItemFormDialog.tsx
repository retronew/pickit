import { useEffect, useState } from "react";
import { createCallable } from "react-call";
import type { Item } from "@pickit/shared";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "#components/ui/combobox";
import { TagsField } from "#components/TagsField";
import { SparklesIcon } from "lucide-react";

interface PossibleDuplicate {
  id: number;
  name: string;
  url: string;
  category: string;
  score: number;
}

interface AnalyzeResult {
  name: string;
  note: string;
  category: string;
  tags: string[];
  icon: string;
  possibleDuplicates?: PossibleDuplicate[];
}

export interface ItemFormPayload {
  name: string;
  url: string;
  icon: string;
  note: string;
  category: string;
  tags: string[];
}

interface Props {
  item: Item | null;
  categories: string[];
  allTags: string[];
  initial?: Partial<ItemFormPayload>;
}

export const ItemFormDialog = createCallable<Props, ItemFormPayload | null>(
  ({ item, categories, allTags, initial, call }) => {
    const isEditing = !!item;
    // Starts closed so Base UI has a real false→true transition to animate —
    // flips true one frame after mount (mirrors @retronew/call-vue's demo).
    const [entered, setEntered] = useState(false);
    useEffect(() => {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }, []);
    const [form, setForm] = useState({
      name: item?.name ?? initial?.name ?? "",
      url: item?.url ?? initial?.url ?? "",
      icon: item?.icon ?? initial?.icon ?? "",
      note: item?.note ?? initial?.note ?? "",
      category: item?.category ?? initial?.category ?? "",
      tags: item?.tags ?? initial?.tags ?? ([] as string[]),
    });
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeMsg, setAnalyzeMsg] = useState("");
    const [possibleDuplicates, setPossibleDuplicates] = useState<PossibleDuplicate[]>([]);

    const canAnalyze = /^https?:\/\/.+/.test(form.url.trim());

    async function analyze() {
      setAnalyzing(true);
      setAnalyzeMsg("");
      setPossibleDuplicates([]);
      try {
        const res = await fetch("/api/items/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: form.url.trim() }),
        });
        const data = (await res.json()) as AnalyzeResult & { error?: string };
        if (!res.ok) {
          setAnalyzeMsg(data.error ?? "识别失败，请重试");
          return;
        }
        setForm((f) => ({
          ...f,
          name: data.name || f.name,
          note: data.note || f.note,
          category: data.category || f.category,
          tags: data.tags?.length ? data.tags : f.tags,
          icon: data.icon || f.icon,
        }));
        setPossibleDuplicates(data.possibleDuplicates ?? []);
      } catch {
        setAnalyzeMsg("网络出问题了，请重试");
      } finally {
        setAnalyzing(false);
      }
    }

    function submit() {
      if (!form.name) return;
      call.end({
        name: form.name,
        url: form.url,
        icon: form.icon,
        note: form.note,
        category: form.category,
        tags: form.tags,
      });
    }

    return (
      <Dialog
        open={entered && !call.ended}
        onOpenChange={(open) => {
          if (!open) call.end(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{isEditing ? "编辑收藏" : "添加收藏"}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <form
              id="item-form"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Field>
                <FieldLabel htmlFor="item-url">网址</FieldLabel>
                <div className="flex w-full gap-2">
                  <Input
                    id="item-url"
                    size="lg"
                    placeholder="粘贴网址，可让 AI 自动识别"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={!canAnalyze || analyzing}
                    loading={analyzing}
                    onClick={analyze}
                    className="shrink-0"
                  >
                    <SparklesIcon />
                    AI 识别
                  </Button>
                </div>
                {analyzeMsg && (
                  <p className="text-destructive-foreground text-xs">
                    {analyzeMsg}
                  </p>
                )}
                {possibleDuplicates.length > 0 && (
                  <div className="bg-warning/4 space-y-1 rounded-md border border-warning/32 p-2 text-xs">
                    <p className="text-warning-foreground font-medium">
                      这个链接和你已收藏的内容很像，可能是同一个东西：
                    </p>
                    {possibleDuplicates.map((d) => (
                      <a
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground block truncate underline-offset-2 hover:underline"
                      >
                        {d.name}
                        {d.category ? `（${d.category}）` : ""} · 相似度{" "}
                        {Math.round(d.score * 100)}%
                      </a>
                    ))}
                  </div>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="item-name">名称 *</FieldLabel>
                <Input
                  id="item-name"
                  size="lg"
                  placeholder="例如：Recharts"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-note">备注</FieldLabel>
                <Input
                  id="item-note"
                  size="lg"
                  placeholder="一句话介绍，方便以后搜索"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-category">分类</FieldLabel>
                <Combobox
                  items={categories}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: (v as string) ?? "" }))
                  }
                  onInputValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <ComboboxInput
                    id="item-category"
                    size="lg"
                    value={form.category}
                    placeholder="选择或输入分类，支持「前端/React」这样的两级分类"
                  />
                  <ComboboxPopup>
                    <ComboboxEmpty>输入即可新建分类</ComboboxEmpty>
                    <ComboboxList>
                      {categories.map((c) => (
                        <ComboboxItem key={c} value={c}>
                          {c}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel htmlFor="item-tags">标签</FieldLabel>
                <TagsField
                  tags={form.tags}
                  onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                  suggestions={allTags}
                />
              </Field>
            </form>
          </DialogPanel>
          <DialogFooter>
            <Button variant="ghost" onClick={() => call.end(null)}>
              取消
            </Button>
            <Button type="submit" form="item-form" disabled={!form.name}>
              保存
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
