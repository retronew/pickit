import { useEffect, useState } from "react";
import { TextSkeleton } from "#components/settings/skeletons";
import { api, copyText, toastError, toastSuccess } from "#lib/api";
import { CopyIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Confirm } from "#components/Confirm";

export function ApiTokenCard() {
  const [masked, setMasked] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);

  function refresh() {
    return api<{ configured: boolean; masked: string | null }>("/api/settings/api-token")
      .then((d) => setMasked(d.masked))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function reset() {
    if (masked) {
      const ok = await Confirm.call({
        title: "重置 API Token？",
        message: "重置后旧 token 立即失效，正在使用它的脚本或工具需要更新。",
        confirmLabel: "重置",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const data = await api<{ token: string }>("/api/settings/api-token/reset", { method: "POST" });
      setNewToken(data.token);
      toastSuccess(masked ? "已重置 Token" : "已生成 Token", { description: "记得马上复制", id: "api-token" });
      refresh();
    } catch (err) {
      toastError(masked ? "重置 Token 失败" : "生成 Token 失败", err, { id: "api-token" });
    }
  }

  async function copy() {
    if (!(await copyText(newToken, "Token 已复制"))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Token</CardTitle>
        <CardDescription>
          需要脚本或第三方工具访问接口时，用这个 token 代替登录密码。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {newToken ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
              {newToken}
            </code>
            <Button variant="outline" size="icon-sm" aria-label="复制" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        ) : !loaded ? (
          <TextSkeleton className="my-0.5 w-48" />
        ) : masked ? (
          <p className="animate-fade-in text-muted-foreground text-sm">
            当前：<code className="text-foreground">{masked}</code>
          </p>
        ) : (
          <p className="animate-fade-in text-muted-foreground text-sm">还没有生成</p>
        )}
        {newToken && (
          <p className="text-muted-foreground text-xs">
            完整内容只显示这一次，记得马上复制。
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="lg" onClick={reset} disabled={!loaded}>
          <RefreshCwIcon />
          {masked ? "重置" : "生成"} Token
        </Button>
      </CardFooter>
    </Card>
  );
}
