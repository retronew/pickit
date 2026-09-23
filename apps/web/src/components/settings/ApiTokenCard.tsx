import { useEffect, useState } from "react";
import { TextSkeleton } from "#components/settings/skeletons";
import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { CopyIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";
import { m } from "#lib/i18n";

export function ApiTokenCard() {
  const [masked, setMasked] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);

  function refresh() {
    return api<{ configured: boolean; masked: string | null }>("/api/settings/api-token")
      .then((d) => setMasked(d.masked))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function reset() {
    if (masked) {
      const ok = await Confirm.call({
        title: m.token_reset_title(),
        message: m.token_reset_message(),
        confirmLabel: m.token_reset(),
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const data = await api<{ token: string }>("/api/settings/api-token/reset", { method: "POST" });
      setNewToken(data.token);
      toastSuccess(masked ? m.token_was_reset() : m.token_generated(), { description: m.token_copy_now(), id: "api-token" });
      refresh();
    } catch (err) {
      toastError(masked ? m.token_reset_failed() : m.token_generate_failed(), err, { id: "api-token" });
    }
  }

  async function copy() {
    if (!(await copyText(newToken, m.token_copied()))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Token</CardTitle>
        <CardDescription>
          {m.token_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {newToken ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
              {newToken}
            </code>
            <Button variant="outline" size="icon-sm" aria-label={m.action_copy()} onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        ) : !loaded ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : masked ? (
          <p className="animate-fade-in text-muted-foreground text-sm">
            {m.token_current()}<code className="text-foreground">{masked}</code>
          </p>
        ) : (
          <p className="animate-fade-in text-muted-foreground text-sm">{m.token_none()}</p>
        )}
        {newToken && (
          <p className="text-muted-foreground text-xs">
            {m.token_shown_once()}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="lg" onClick={reset} disabled={!loaded}>
          <RefreshCwIcon />
          {masked ? m.token_reset_button() : m.token_generate_button()}
        </Button>
      </CardFooter>
    </Card>
  );
}
