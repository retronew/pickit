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
import { ShareAccessFields, type ExpiryChoice } from "#components/shares/ShareAccessFields";
import { toastError, toastSuccess } from "#lib/api";
import { formatDate } from "#lib/format";
import { expiryAt, isExpired, updateShareAccess, type Share, type ShareAccess } from "#lib/shares";
import { m } from "#lib/i18n";

/** Changes an existing share's expiry and password. Resolves to true when saved. */
export const ShareAccessDialog = createCallable<{ share: Share }, boolean>(({ share, call }) => {
  const [entered, setEntered] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>(share.expiresAt === null ? "never" : "keep");
  const [protect, setProtect] = useState(share.hasPassword);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  // Turning protection on needs a password, unless there already is one to keep.
  const missingPassword = protect && !password && !share.hasPassword;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const keepLabel =
    share.expiresAt === null
      ? undefined
      : isExpired(share)
        ? m.share_expiry_keep_expired({ date: formatDate(share.expiresAt) })
        : m.share_expiry_keep({ date: formatDate(share.expiresAt) });

  async function save() {
    if (saving || missingPassword) return;
    const access: ShareAccess = {
      expiresAt: expiry === "keep" ? undefined : expiryAt(expiry),
      password: protect ? password || undefined : share.hasPassword ? null : undefined,
    };
    setSaving(true);
    try {
      await updateShareAccess(share.slug, access);
      toastSuccess(m.share_access_saved(), { id: "share" });
      call.end(true);
    } catch (err) {
      toastError(m.share_access_failed(), err, { id: "share" });
      setSaving(false);
    }
  }

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end(false)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{m.share_access_title()}</DialogTitle>
          <DialogDescription className="truncate">{share.title || share.value}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <ShareAccessFields
              expiry={expiry}
              onExpiryChange={setExpiry}
              keepLabel={keepLabel}
              protect={protect}
              onProtectChange={setProtect}
              password={password}
              onPasswordChange={setPassword}
              hasPassword={share.hasPassword}
            />
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => call.end(false)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={save} disabled={missingPassword} loading={saving}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
