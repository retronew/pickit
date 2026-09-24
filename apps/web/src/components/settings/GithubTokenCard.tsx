import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { TextSkeleton } from "#components/settings/skeletons";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

interface TokenState {
  masked: string | null;
  /** No token saved here, but the GITHUB_TOKEN secret is set. */
  fromSecret: boolean;
}

/** GitHub token for project activity checks (raises GitHub's API limit). */
export function GithubTokenCard() {
  const [state, setState] = useState<TokenState | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = () =>
    api<TokenState>("/api/settings/github-token")
      .then(setState)
      .catch(() => setState({ masked: null, fromSecret: false }));

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!token.trim() || saving) return;
    setSaving(true);
    try {
      const res = await api<{ limit: number }>("/api/settings/github-token", { method: "PUT", json: { token } });
      toastSuccess(m.github_token_saved({ limit: res.limit }), { id: "github-token" });
      setToken("");
      refresh();
    } catch (err) {
      toastError(m.github_token_save_failed(), err, { id: "github-token" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api("/api/settings/github-token", { method: "DELETE" });
      refresh();
    } catch (err) {
      toastError(m.github_token_save_failed(), err, { id: "github-token" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Token</CardTitle>
        <CardDescription>{m.github_token_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === null ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : (
          <p className="animate-fade-in text-muted-foreground text-sm">
            {state.masked ? (
              <>
                {m.token_current()}
                <code className="text-foreground">{state.masked}</code>
              </>
            ) : state.fromSecret ? (
              m.github_token_from_secret()
            ) : (
              m.github_token_none()
            )}
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_… / github_pat_…"
            aria-label="GitHub Token"
          />
          <Button type="submit" disabled={!token.trim()} loading={saving}>
            {m.common_save()}
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">{m.github_token_hint()}</p>
      </CardContent>
      {state?.masked && (
        <CardFooter>
          <Button variant="outline" size="lg" onClick={remove}>
            {m.github_token_remove()}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
