import { useState } from "react";
import { toastError, toastSuccess } from "#lib/api";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Textarea } from "#components/ui/textarea";
import { Button } from "#components/ui/button";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";

interface Progress {
  total: number;
  done: number;
  added: number;
  skipped: number;
  failed: number;
}

async function analyzeAndSave(
  url: string,
): Promise<"added" | "skipped" | "failed"> {
  let payload: {
    name: string;
    url: string;
    icon: string;
    note: string;
    category: string;
    tags: string[];
  };
  try {
    const res = await fetch("/api/items/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      payload = {
        name: data.name || new URL(url).hostname,
        url,
        icon: data.icon || "",
        note: data.note || "",
        category: data.category || "",
        tags: data.tags ?? [],
      };
    } else {
      payload = {
        name: new URL(url).hostname,
        url,
        icon: "",
        note: "",
        category: "",
        tags: [],
      };
    }
  } catch {
    return "failed";
  }
  try {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) return "skipped";
    return res.ok ? "added" : "failed";
  } catch {
    return "failed";
  }
}

export function BatchAddDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  async function start() {
    const urls = [
      ...new Set(
        text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => /^https?:\/\//.test(l)),
      ),
    ];
    if (urls.length === 0) return;
    setRunning(true);
    const p: Progress = { total: urls.length, done: 0, added: 0, skipped: 0, failed: 0 };
    setProgress({ ...p });

    let idx = 0;
    async function worker() {
      while (idx < urls.length) {
        const url = urls[idx++];
        const result = await analyzeAndSave(url);
        p.done++;
        p[result]++;
        setProgress({ ...p });
      }
    }
    await Promise.all([worker(), worker()]);

    setRunning(false);
    const summary = `新增 ${p.added} 条，跳过 ${p.skipped} 条重复${p.failed ? `，失败 ${p.failed} 条` : ""}`;
    if (p.failed && !p.added) toastError("批量添加失败", new Error(summary), { id: "batch-add" });
    else toastSuccess("批量添加完成", { description: summary, id: "batch-add" });
    onDone();
  }

  function close() {
    if (running) return;
    setText("");
    setProgress(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>批量添加</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <Field>
            <FieldLabel htmlFor="batch-urls">每行一个网址</FieldLabel>
            <Textarea
              id="batch-urls"
              className="min-h-40 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={running}
              placeholder={"https://a.com\nhttps://b.com"}
            />
            <FieldDescription>
              会逐个用 AI 识别并添加，一次处理两个。
            </FieldDescription>
          </Field>
          {progress && (
            <p className="mt-3 text-muted-foreground text-sm">
              已完成 {progress.done}/{progress.total} · 新增 {progress.added} ·
              重复 {progress.skipped}
              {progress.failed > 0 && ` · 失败 ${progress.failed}`}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={running}>
            {progress && !running ? "完成" : "取消"}
          </Button>
          <Button
            onClick={start}
            disabled={running || !text.trim()}
            loading={running}
          >
            开始添加
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
