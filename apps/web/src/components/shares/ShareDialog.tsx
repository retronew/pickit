import { useEffect, useState } from "react";
import { createCallable } from "react-call";
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
import { Input } from "#components/ui/input";
import { Field, FieldLabel } from "#components/ui/field";
import { ShareTargetPicker, type PickableType } from "#components/shares/ShareTargetPicker";
import { copyText, toastError } from "#lib/api";
import { createShare, defaultShareTitle, shareUrl, type ShareTarget } from "#lib/shares";
import { m } from "#lib/i18n";

interface Props {
  /** What to share; omitted = pick a category or tag in the dialog. */
  target?: ShareTarget;
}

/** Names a new public link, creates it and copies it. Resolves to the slug. */
export const ShareDialog = createCallable<Props, string | null>(({ target, call }) => {
  const [entered, setEntered] = useState(false);
  const [pickType, setPickType] = useState<PickableType>("category");
  const [pickValue, setPickValue] = useState("");
  const resolved: ShareTarget | null = target ?? (pickValue ? { type: pickType, value: pickValue } : null);
  const placeholder = resolved ? defaultShareTitle(resolved) : "";
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  async function submit() {
    if (!resolved || saving) return;
    setSaving(true);
    try {
      const slug = await createShare(resolved, title.trim() || undefined);
      await copyText(shareUrl(slug), m.share_link_copied());
      call.end(slug);
    } catch (err) {
      toastError(m.share_failed(), err, { id: "share" });
      setSaving(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(null)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{target?.type === "collection" ? m.share_collection_title() : m.share_dialog_title()}</DialogTitle>
          <DialogDescription>
            {target?.type === "collection"
              ? m.share_collection_hint({ count: target.ids.length })
              : m.share_dialog_hint()}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {!target && (
              <ShareTargetPicker
                type={pickType}
                value={pickValue}
                onTypeChange={setPickType}
                onValueChange={setPickValue}
              />
            )}
            <Field>
              <FieldLabel htmlFor="share-title">{m.share_title_label()}</FieldLabel>
              <Input
                id="share-title"
                value={title}
                maxLength={200}
                placeholder={placeholder}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus={!!target}
              />
            </Field>
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => call.end(null)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={submit} disabled={!resolved} loading={saving}>
            {m.share_create_copy()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
