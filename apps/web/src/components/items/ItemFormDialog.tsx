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
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { ItemFormFields, type ItemFormPayload } from "#components/items/ItemFormFields";
import { errorMessage, toastError } from "#lib/api";
import { m } from "#lib/i18n";

export type { ItemFormPayload };

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
      image: item?.image ?? initial?.image ?? "",
      note: item?.note ?? initial?.note ?? "",
      category: item?.category ?? initial?.category ?? "",
      tags: item?.tags ?? initial?.tags ?? ([] as string[]),
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    async function submit() {
      if (!form.name || saving) return;
      const payload: ItemFormPayload = {
        name: form.name,
        url: form.url,
        icon: form.icon,
        image: form.image,
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
        toastError(m.save_failed(), err, { id: "item-save" });
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
            <DialogTitle>{isEditing ? m.form_edit_title() : m.form_add_title()}</DialogTitle>
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
              <ItemFormFields value={form} onChange={setForm} categories={categories} allTags={allTags} />
            </form>
          </DialogPanel>
          <DialogFooter className="sm:items-center">
            {saveError && (
              <p className="text-destructive col-span-full me-auto text-sm">{saveError}</p>
            )}
            <Button variant="outline" disabled={saving} onClick={() => call.end(null)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" form="item-form" disabled={!form.name || saving}>
              {saving && <Spinner />}
              {saving ? m.common_saving() : m.common_save()}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  },
  200,
);
