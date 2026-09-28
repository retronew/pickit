// Outcome of "Test chat" / "Test embedding": the message plus, for chat,
// timing, token usage and whether the model thought before answering.

import type { ChatTestReport } from "@pickit/shared";
import { formatDuration } from "#lib/format";
import { REASONING_LABELS } from "./ReasoningField";
import type { TestState } from "./shared";
import { m } from "#lib/i18n";

export function TestResult({ state }: { state: TestState }) {
  if (!state.text) return null;
  return (
    <div className="space-y-2">
      <p
        className={
          state.ok
            ? "text-sm text-emerald-700 dark:text-emerald-400"
            : "text-destructive min-w-0 break-all text-sm"
        }
      >
        {state.text}
        {state.durationMs !== undefined && !state.report && (
          <span className="text-muted-foreground"> · {m.ai_test_duration({ time: formatDuration(state.durationMs) })}</span>
        )}
      </p>
      {state.report && <ChatReport report={state.report} />}
    </div>
  );
}

function ChatReport({ report }: { report: ChatTestReport }) {
  const thought = !!report.reasoningText || (report.reasoningTokens ?? 0) > 0;
  const timing = [m.ai_test_duration({ time: formatDuration(report.durationMs) })];
  if (report.firstTokenMs !== null) timing.push(m.ai_test_first_token({ time: formatDuration(report.firstTokenMs) }));
  let tokens =
    report.inputTokens !== null || report.outputTokens !== null
      ? m.ai_test_tokens({ input: String(report.inputTokens ?? "?"), output: String(report.outputTokens ?? "?") })
      : "";
  if (tokens && report.reasoningTokens) tokens += ` (${m.ai_test_reasoning_tokens({ count: String(report.reasoningTokens) })})`;

  return (
    <div className="bg-muted/50 space-y-1.5 rounded-lg px-3 py-2 text-xs">
      <p className="tabular-nums">{timing.join(" · ")}</p>
      {tokens && <p className="text-muted-foreground tabular-nums">{tokens}</p>}
      <p className="text-muted-foreground">
        {m.ai_test_reasoning_setting({ level: REASONING_LABELS[report.reasoning]() })} ·{" "}
        <span className={thought ? "text-foreground" : undefined}>
          {thought ? m.ai_test_thought() : m.ai_test_no_thought()}
        </span>
      </p>
      <p className="text-muted-foreground break-all">{m.ai_test_model({ model: report.modelId })}</p>
      {report.finishReason === "length" && <p className="text-destructive">{m.ai_test_truncated()}</p>}
      {report.reasoningText && (
        <details>
          <summary className="text-muted-foreground cursor-pointer">{m.ai_test_reasoning_excerpt()}</summary>
          <p className="mt-1 whitespace-pre-wrap break-words">{report.reasoningText}</p>
        </details>
      )}
    </div>
  );
}
