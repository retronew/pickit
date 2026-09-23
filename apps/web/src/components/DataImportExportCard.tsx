import { useRef, useState } from "react";
import { UploadIcon, DownloadIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#components/ui/card";
import { Field, FieldLabel } from "#components/ui/field";
import { Textarea } from "#components/ui/textarea";
import { Button } from "#components/ui/button";
import { Separator } from "#components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "#components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "#components/ui/table";
import { buttonVariants } from "#components/ui/button";
import { cn } from "#lib/utils";

type Format = "markdown" | "json" | "html";

const FORMAT_LABELS: Record<Format, string> = {
  markdown: "Markdown 表格",
  json: "JSON（pickit 格式）",
  html: "浏览器书签 HTML",
};

interface PreviewRow {
  name: string;
  url: string;
  category: string;
  skipped: boolean;
}

interface ImportResult {
  parsed: number;
  inserted: number;
  skipped: number;
  preview: PreviewRow[];
}

export function DataImportExportCard() {
  const [format, setFormat] = useState<Format>("markdown");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function runImport(dryRun: boolean) {
    if (!content.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "导入失败");
        setPreview(null);
        return;
      }
      if (dryRun) {
        setPreview(data as ImportResult);
      } else {
        setPreview(null);
        setContent("");
        setMessage(`导入完成：新增 ${data.inserted} 条，跳过 ${data.skipped} 条重复`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>数据导入导出</CardTitle>
        <CardDescription>
          支持 Markdown 表格、浏览器书签 HTML、pickit 自身的 JSON 导出格式。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <span className="block text-xs font-medium text-muted-foreground">
            导入
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as Format)}
              items={FORMAT_LABELS}
            >
              <SelectTrigger size="sm" className="w-auto min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon />
              选择文件
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.json,.html,.htm"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setContent(await file.text());
                e.target.value = "";
              }}
            />
          </div>
          <Field>
            <FieldLabel htmlFor="import-content">或直接粘贴内容</FieldLabel>
            <Textarea
              id="import-content"
              className="min-h-32 font-mono text-xs"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setPreview(null);
              }}
              placeholder="粘贴 Markdown 表格 / 浏览器导出的书签 HTML / pickit 导出的 JSON"
            />
          </Field>

          {preview && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                识别到 {preview.parsed} 条：将新增 {preview.inserted} 条，跳过{" "}
                {preview.skipped} 条重复
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-48 truncate">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.category || "—"}</TableCell>
                        <TableCell>
                          {row.skipped ? (
                            <span className="text-muted-foreground">已存在</span>
                          ) : (
                            <span className="text-success-foreground">将新增</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {message && <p className="text-muted-foreground text-sm">{message}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={!content.trim() || busy}
              onClick={() => runImport(true)}
            >
              预览导入
            </Button>
            <Button
              size="lg"
              disabled={!preview || busy}
              loading={busy}
              onClick={() => runImport(false)}
            >
              确认导入
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">
            导出全部数据
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["json", "markdown", "html"] as const).map((f) => (
              <a
                key={f}
                href={`/api/items/export?format=${f}`}
                download
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <DownloadIcon />
                {f.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
