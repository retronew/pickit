import { useEffect, useState, type FormEvent } from "react";
import { ListSkeleton } from "#components/settings/skeletons";
import { api, errorMessage, toastSuccess } from "#lib/api";
import { LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Confirm } from "#components/Confirm";
import { m } from "#lib/i18n";

interface AllowedEmails {
  owners: string[];
  emails: string[];
}

export function AllowedEmailsCard() {
  const [data, setData] = useState<AllowedEmails | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AllowedEmails>("/api/settings/allowed-emails")
      .then(setData)
      .catch((err) => setError(m.load_failed({ error: errorMessage(err) })));
  }, []);

  async function save(emails: string[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/allowed-emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? m.save_failed());
        return false;
      }
      setData(body);
      toastSuccess(m.emails_saved(), { id: "allowed-emails" });
      return true;
    } catch {
      setError(m.error_network());
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!data || !draft.trim()) return;
    if (await save([...data.emails, draft])) setDraft("");
  }

  async function remove(email: string) {
    if (!data) return;
    const ok = await Confirm.call({
      title: m.emails_remove_title({ email }),
      message: m.emails_remove_message(),
      confirmLabel: m.action_remove(),
      danger: true,
    });
    if (ok) await save(data.emails.filter((x) => x !== email));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.emails_title()}</CardTitle>
        <CardDescription>
          {m.emails_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !error && <ListSkeleton rows={2} />}
        {data && (
          <div className="animate-fade-in space-y-1">
            {data.owners.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
              >
                <span className="truncate">{email}</span>
                <LockIcon className="text-muted-foreground size-3.5 shrink-0" aria-label={m.emails_owner()} />
              </div>
            ))}
            {data.emails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
              >
                <span className="truncate">{email}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={m.action_remove()}
                  disabled={saving}
                  onClick={() => remove(email)}
                  className="text-muted-foreground hover:text-destructive-foreground"
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            type="email"
            size="lg"
            placeholder="name@example.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={m.emails_new()}
          />
          <Button type="submit" variant="outline" size="lg" disabled={saving || !draft.trim()}>
            <PlusIcon />
            {m.action_add()}
          </Button>
        </form>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>
    </Card>
  );
}
