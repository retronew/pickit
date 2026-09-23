import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";
import { copyText } from "#lib/api";
import { m } from "#lib/i18n";

const token = () => m.mcp_token_placeholder();

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 pr-10 font-mono text-xs leading-relaxed">{code}</pre>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.action_copy()}
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
      code: `claude mcp add --transport http pickit ${url} \\\n  --header "Authorization: Bearer ${token()}"`,
    },
    json: {
      label: m.mcp_json(),
      code: JSON.stringify(
        { mcpServers: { pickit: { type: "http", url, headers: { Authorization: `Bearer ${token()}` } } } },
        null,
        2,
      ),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.mcp_title()}</CardTitle>
        <CardDescription>
          {m.mcp_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">{m.mcp_endpoint()}</p>
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
          {m.mcp_tools()}
        </p>
      </CardContent>
    </Card>
  );
}
