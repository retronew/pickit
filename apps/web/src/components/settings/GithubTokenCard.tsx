import { useState } from "react";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { TextSkeleton } from "#components/settings/skeletons";
import { GithubTokenStatus } from "#components/settings/GithubTokenStatus";
import { useGithubToken } from "#hooks/useGithubToken";
import { m } from "#lib/i18n";

/** Fine-grained token with only public, read-only repository access. */
const CREATE_URL = "https://github.com/settings/personal-access-tokens/new";

/** GitHub token for project activity checks (raises GitHub's API limit). */
export function GithubTokenCard() {
  const { info, status, checking, saving, check, save, remove } = useGithubToken();
  const [token, setToken] = useState("");
  const hasToken = !!info?.masked;

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Token</CardTitle>
        <CardDescription>{m.github_token_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {info === null ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : (
          <div className="animate-fade-in space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm">
                {hasToken ? (
                  <>
                    <span className="text-muted-foreground">{m.token_current()}</span>
                    <code>{info.masked}</code>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {info.fromSecret ? m.github_token_from_secret() : m.github_token_none()}
                  </span>
                )}
              </p>
              {(hasToken || info.fromSecret) && (
                <Button variant="outline" size="sm" onClick={check} loading={checking}>
                  <RefreshCwIcon />
                  {m.github_token_check()}
                </Button>
              )}
              {hasToken && (
                <Button variant="ghost" size="sm" onClick={remove} className="text-muted-foreground">
                  {m.github_token_remove()}
                </Button>
              )}
            </div>
            {status && <GithubTokenStatus status={status} />}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (token.trim() && (await save(token.trim()))) setToken("");
          }}
        >
          <Field>
            <FieldLabel htmlFor="github-token">{hasToken ? m.github_token_replace() : m.github_token_add()}</FieldLabel>
            <div className="flex w-full gap-2">
              <Input
                id="github-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_… / ghp_…"
              />
              <Button type="submit" disabled={!token.trim()} loading={saving}>
                {m.common_save()}
              </Button>
            </div>
          </Field>
        </form>
        <p className="text-muted-foreground text-xs">
          {m.github_token_hint()}{" "}
          <a href={CREATE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
            {m.github_token_create()}
            <ExternalLinkIcon className="size-3" />
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
