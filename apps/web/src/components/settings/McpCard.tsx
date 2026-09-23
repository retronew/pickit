import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";
import { copyText } from "#lib/api";

const TOKEN = "<你的 API Token>";

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 pr-10 font-mono text-xs leading-relaxed">{code}</pre>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="复制"
        className="absolute top-2 right-2"
        onClick={async () => {
          if (await copyText(code)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}

/** How to connect AI assistants to PickIt over MCP. */
export function McpCard() {
  const url = `${window.location.origin}/api/mcp`;
  const clients = {
    "claude-code": {
      label: "Claude Code",
      code: `claude mcp add --transport http pickit ${url} \\\n  --header "Authorization: Bearer ${TOKEN}"`,
    },
    json: {
      label: "JSON 配置",
      code: JSON.stringify(
        { mcpServers: { pickit: { type: "http", url, headers: { Authorization: `Bearer ${TOKEN}` } } } },
        null,
        2,
      ),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP 接入</CardTitle>
        <CardDescription>
          让 Claude 等 AI 助手直接搜索、查看和添加你的收藏。鉴权使用上面的 API Token，调用会记录在审计日志里。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">服务地址（Streamable HTTP）</p>
          <Snippet code={url} />
        </div>
        <Tabs defaultValue="claude-code">
          <TabsList variant="underline">
            {Object.entries(clients).map(([id, c]) => (
              <TabsTab key={id} value={id}>
                {c.label}
              </TabsTab>
            ))}
          </TabsList>
          {Object.entries(clients).map(([id, c]) => (
            <TabsPanel key={id} value={id} className="pt-1">
              <Snippet code={c.code} />
            </TabsPanel>
          ))}
        </Tabs>
        <p className="text-muted-foreground text-xs">
          可用工具：搜索收藏、查看收藏、按分类或标签列出收藏、列出分类、列出标签、添加收藏。
        </p>
      </CardContent>
    </Card>
  );
}
