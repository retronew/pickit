import { useRef, useState } from "react";
import { toastError, toastSuccess } from "#lib/api";
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
import { m } from "#lib/i18n";

type Format = "markdown" | "json" | "html";

const FORMAT_LABELS: Record<Format, string> = {
  markdown: m.import_format_markdown(),
  json: m.import_format_json(),
  html: m.import_format_html(),
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
        setMessage(data.error ?? m.import_failed());
        toastError(m.import_failed(), new Error(data.error ?? m.import_check_format()), { id: "import" });
        setPreview(null);
        return;
      }
      if (dryRun) {
        setPreview(data as ImportResult);
      } else {
        setPreview(null);
        setContent("");
        setMessage(m.import_done_message({ inserted: data.inserted, skipped: data.skipped }));
        toastSuccess(m.import_done(), {
          description: m.batch_summary({ added: data.inserted, skipped: data.skipped }),
          id: "import",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.import_title()}</CardTitle>
        <CardDescription>
          {m.import_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <span className="block text-xs font-medium text-muted-foreground">
            {m.import_label()}
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
              {m.import_choose_file()}
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
            <FieldLabel htmlFor="import-content">{m.import_paste_label()}</FieldLabel>
            <Textarea
              id="import-content"
              className="min-h-32 font-mono text-xs"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setPreview(null);
              }}
              placeholder={m.import_paste_placeholder()}
            />
          </Field>

          {preview && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {m.import_preview_summary({ parsed: preview.parsed, inserted: preview.inserted, skipped: preview.skipped })}
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.field_name()}</TableHead>
                      <TableHead>{m.field_category()}</TableHead>
                      <TableHead>{m.field_status()}</TableHead>
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
                            <span className="text-muted-foreground">{m.import_exists()}</span>
                          ) : (
                            <span className="text-success-foreground">{m.import_will_add()}</span>
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
              {m.import_preview()}
            </Button>
            <Button
              size="lg"
              disabled={!preview || busy}
              loading={busy}
              onClick={() => runImport(false)}
            >
              {m.import_confirm()}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">
            {m.export_all()}
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
