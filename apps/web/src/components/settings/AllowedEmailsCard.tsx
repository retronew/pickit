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
      .catch((err) => setError(`加载失败：${errorMessage(err)}`));
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
        setError(body.error ?? "保存失败");
        return false;
      }
      setData(body);
      toastSuccess("已保存允许登录的邮箱", { id: "allowed-emails" });
      return true;
    } catch {
      setError("网络出问题了，请重试");
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
      title: `移除 ${email}？`,
      message: "移除后这个邮箱立即无法访问，已登录的会话也会失效。",
      confirmLabel: "移除",
      danger: true,
    });
    if (ok) await save(data.emails.filter((x) => x !== email));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>允许登录的邮箱</CardTitle>
        <CardDescription>
          只有列表里的 Google / GitHub 账号邮箱可以登录。带锁的来自部署密钥
          ALLOWED_EMAILS，不能在这里移除。
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
                <LockIcon className="text-muted-foreground size-3.5 shrink-0" aria-label="部署密钥" />
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
                  aria-label="移除"
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
            aria-label="新增邮箱"
          />
          <Button type="submit" variant="outline" size="lg" disabled={saving || !draft.trim()}>
            <PlusIcon />
            添加
          </Button>
        </form>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>
    </Card>
  );
}
