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
import { Textarea } from "#components/ui/textarea";
import { Button } from "#components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "#components/ui/combobox";
import { TagsField } from "#components/items/TagsField";
import { PossibleDuplicates } from "#components/items/PossibleDuplicates";
import { useUrlAnalyzer } from "#hooks/useUrlAnalyzer";
import { SparklesIcon } from "lucide-react";
import { Spinner } from "#components/ui/spinner";
import { errorMessage, toastError } from "#lib/api";

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
  /**
   * Saves the form. Resolves true to close the dialog, false to keep it open;
   * a thrown error is shown in the dialog, which also stays open.
   */
  onSubmit: (payload: ItemFormPayload) => Promise<boolean>;
}

export const ItemFormDialog = createCallable<Props, ItemFormPayload | null>(
  ({ item, categories, allTags, initial, onSubmit, call }) => {
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
    const { analyzing, analyzeMsg, possibleDuplicates, analyze } = useUrlAnalyzer((data) =>
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        note: data.note || f.note,
        category: data.category || f.category,
        tags: data.tags?.length ? data.tags : f.tags,
        icon: data.icon || f.icon,
      })),
    );
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const canAnalyze = /^https?:\/\/.+/.test(form.url.trim());

    async function submit() {
      if (!form.name || saving) return;
      const payload: ItemFormPayload = {
        name: form.name,
        url: form.url,
        icon: form.icon,
        note: form.note,
        category: form.category,
        tags: form.tags,
      };
      setSaving(true);
      setSaveError("");
      try {
        if (await onSubmit(payload)) call.end(payload);
      } catch (err) {
        setSaveError(errorMessage(err));
        toastError("保存失败", err, { id: "item-save" });
      } finally {
        setSaving(false);
      }
    }

    return (
      <Dialog
        open={entered && !call.ended}
        onOpenChange={(open) => {
          if (!open && !saving) call.end(null);
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
                    onClick={() => analyze(form.url.trim())}
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
                <PossibleDuplicates items={possibleDuplicates} />
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
                <Textarea
                  id="item-note"
                  size="lg"
                  placeholder="介绍一下它，方便以后搜索（支持多行和 Markdown）"
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
          <DialogFooter className="items-center">
            {saveError && (
              <p className="text-destructive me-auto text-sm">{saveError}</p>
            )}
            <Button variant="ghost" disabled={saving} onClick={() => call.end(null)}>
              取消
            </Button>
            <Button type="submit" form="item-form" disabled={!form.name || saving}>
              {saving && <Spinner />}
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
