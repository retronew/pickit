// Small presentational pieces of the AI settings card.

import { type RequestUrl } from "@pickit/shared";
import { CardContent, CardFooter } from "#components/ui/card";
import { Skeleton } from "#components/ui/skeleton";
import { FieldSkeleton, ButtonsSkeleton } from "#components/settings/skeletons";
import type { TestState } from "./shared";

export function PanelHeading({ title, configured }: { title: string; configured?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      {configured !== undefined && (
        <span
          className={
            configured
              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
          }
        >
          {configured ? "已启用" : "未配置"}
        </span>
      )}
    </div>
  );
}

export function RequestPreview({ urls }: { urls: RequestUrl[] }) {
  return (
    <div className="bg-muted/50 space-y-1 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-xs">按当前设置，实际请求的地址：</p>
      {urls.map((u) => (
        <p key={u.label} className="flex gap-2 text-xs">
          <span className="text-muted-foreground w-14 shrink-0">{u.label}</span>
          <code className="min-w-0 break-all">{u.url}</code>
        </p>
      ))}
    </div>
  );
}

export function TestResult({ state }: { state: TestState }) {
  if (!state.text) return null;
  return (
    <p
      className={
        state.ok
          ? "text-sm text-emerald-700 dark:text-emerald-400"
          : "text-destructive min-w-0 break-all text-sm"
      }
    >
      {state.text}
    </p>
  );
}

function PanelSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-5 w-24" />
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
    </section>
  );
}

/** Same shape as the loaded card: two endpoint panels and the action row. */
export function AiSettingsSkeleton() {
  return (
    <>
      <CardContent className="grid gap-8 lg:grid-cols-[1fr_auto_1fr]" aria-busy="true" aria-label="加载中">
        <PanelSkeleton />
        <div className="h-px bg-border lg:h-auto lg:w-px" />
        <PanelSkeleton />
      </CardContent>
      <CardFooter>
        <ButtonsSkeleton widths={["w-16", "w-28", "w-28"]} />
      </CardFooter>
    </>
  );
}
