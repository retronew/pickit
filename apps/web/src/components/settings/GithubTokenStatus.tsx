import { Badge } from "#components/ui/badge";
import { Hint } from "#components/Hint";
import type { GithubTokenStatus as Status } from "#hooks/useGithubToken";
import { formatDate, formatDateTime } from "#lib/format";
import { m } from "#lib/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Warn this long before a token expires. */
const EXPIRY_WARNING_DAYS = 7;

/** Validity, remaining quota and expiry of the GitHub token in use. */
export function GithubTokenStatus({ status }: { status: Status }) {
  if (!status.configured) return null;
  if (!status.reachable) {
    return <p className="text-muted-foreground text-xs">{m.github_token_unreachable()}</p>;
  }
  if (!status.valid) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="destructive" size="sm">
          {m.github_token_invalid()}
        </Badge>
        <span className="text-muted-foreground">{m.github_token_invalid_hint()}</span>
      </div>
    );
  }

  const now = Date.now();
  const expiresAt = status.expiresAt ?? null;
  const daysLeft = expiresAt === null ? null : Math.ceil((expiresAt - now) / DAY_MS);
  const expiry =
    expiresAt === null
      ? m.github_token_never_expires()
      : m.github_token_expires({ date: formatDate(expiresAt) });

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Badge variant="success" size="sm">
        {m.github_token_valid()}
      </Badge>
      {status.limit !== undefined && (
        <Hint content={status.resetAt ? m.github_token_resets({ date: formatDateTime(status.resetAt) }) : undefined}>
          <span className="text-muted-foreground tabular-nums">
            {m.github_token_quota({ remaining: status.remaining ?? 0, limit: status.limit })}
          </span>
        </Hint>
      )}
      <span
        className={
          daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS ? "text-destructive-foreground" : "text-muted-foreground"
        }
      >
        · {expiry}
        {daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS && ` (${m.github_token_expires_soon({ count: daysLeft })})`}
      </span>
    </div>
  );
}
