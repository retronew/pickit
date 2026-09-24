import { useState } from "react";
import { LockIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Input } from "#components/ui/input";
import { m } from "#lib/i18n";

/** Asks for a share's password; `onUnlock` resolves to false when it is wrong. */
export function SharePasswordForm({ onUnlock }: { onUnlock: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!(await onUnlock(password))) setError(m.public_password_wrong());
    } catch {
      setError(m.public_load_failed());
    }
    setBusy(false);
  }

  return (
    <Card className="mx-auto w-full max-w-sm animate-fade-in p-6">
      <form onSubmit={submit} className="space-y-4 text-center">
        <LockIcon className="mx-auto size-6 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-lg">{m.public_password_title()}</h1>
          <p className="text-muted-foreground text-sm">{m.public_password_hint()}</p>
        </div>
        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label={m.share_password_label()}
          aria-invalid={!!error || undefined}
        />
        {error && <p className="text-destructive-foreground text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={!password} loading={busy}>
          {m.public_password_submit()}
        </Button>
      </form>
    </Card>
  );
}
