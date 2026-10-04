import type { AiUsageModel } from "@pickit/shared";
import { Badge } from "#components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#components/ui/table";
import { AI_KIND_LABELS, formatCount, formatTokens } from "#lib/ai-usage";
import { m } from "#lib/i18n";

function ModelName({ row }: { row: AiUsageModel }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate font-medium" title={`${row.provider} / ${row.model}`}>
        {row.model}
      </span>
      <Badge variant="outline" size="sm" className="shrink-0">
        {AI_KIND_LABELS[row.kind]()}
      </Badge>
    </span>
  );
}

/** Calls and tokens per model: a table on wide screens, cards on phones. */
export function AiModelList({ data }: { data: AiUsageModel[] }) {
  return (
    <>
      <Table className="max-sm:hidden">
        <TableHeader>
          <TableRow>
            <TableHead>{m.ai_usage_col_model()}</TableHead>
            <TableHead className="text-right">{m.ai_usage_col_calls()}</TableHead>
            <TableHead className="text-right">{m.ai_usage_col_input()}</TableHead>
            <TableHead className="text-right">{m.ai_usage_col_output()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.kind}:${r.provider}:${r.model}`}>
              <TableCell className="max-w-64">
                <ModelName row={r} />
                <span className="block truncate text-muted-foreground text-xs">{r.provider}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(r.calls)}
                {r.failed > 0 && (
                  <span className="block text-destructive text-xs">
                    {m.ai_usage_failed_count({ count: formatCount(r.failed) })}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={formatCount(r.inputTokens)}>
                {formatTokens(r.inputTokens)}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={formatCount(r.outputTokens)}>
                {r.kind === "embedding" ? "—" : formatTokens(r.outputTokens)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="space-y-2 sm:hidden">
        {data.map((r) => (
          <li key={`${r.kind}:${r.provider}:${r.model}`} className="rounded-lg border px-3 py-2">
            <ModelName row={r} />
            <p className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground text-xs tabular-nums">
              <span>
                {m.ai_usage_col_calls()} {formatCount(r.calls)}
                {r.failed > 0 && (
                  <span className="text-destructive"> · {m.ai_usage_failed_count({ count: formatCount(r.failed) })}</span>
                )}
              </span>
              <span>
                {m.ai_usage_col_input()} {formatTokens(r.inputTokens)}
              </span>
              {r.kind === "chat" && (
                <span>
                  {m.ai_usage_col_output()} {formatTokens(r.outputTokens)}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
