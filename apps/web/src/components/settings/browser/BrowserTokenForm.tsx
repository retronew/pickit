import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { m } from "#lib/i18n";

const CREATE_URL = "https://dash.cloudflare.com/profile/api-tokens";

/** The Cloudflare API token: shows the saved one masked, replaces or removes it. */
export function BrowserTokenForm({
  masked,
  canSave,
  saving,
  onSave,
  onRemove,
}: {
  masked: string | null;
  /** The account ID is needed to verify a token. */
  canSave: boolean;
  saving: boolean;
  onSave: (token: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const [token, setToken] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (token.trim() && (await onSave(token.trim()))) setToken("");
      }}
    >
      <Field>
        <FieldLabel htmlFor="browser-token">API Token</FieldLabel>
        <div className="flex w-full flex-wrap items-center gap-2 text-sm">
          {masked ? (
            <>
              <span className="text-muted-foreground">{m.token_current()}</span>
              <code>{masked}</code>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-muted-foreground">
                {m.github_token_remove()}
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">{m.github_token_none()}</span>
          )}
        </div>
        <div className="flex w-full gap-2">
          <Input
            id="browser-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={masked ? m.github_token_replace() : m.github_token_add()}
          />
          <Button type="submit" disabled={!token.trim() || !canSave} loading={saving}>
            {m.common_save()}
          </Button>
        </div>
      </Field>
      <p className="text-muted-foreground text-xs">
        {m.browser_render_token_hint()}{" "}
        <a href={CREATE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
          {m.browser_render_token_create()}
          <ExternalLinkIcon className="size-3" />
        </a>
      </p>
    </form>
  );
}
