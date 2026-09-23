import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { SparkleIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { Card } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Favicon } from "#components/Favicon";
import { cn } from "#lib/utils";
import { useChat, extractRefIds, renderableText } from "#hooks/useChat";

export function AskAi() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double rAF: guarantees the browser paints the closed state at
      // least once before we flip to open, so the transition actually
      // has something to animate from (a single rAF can race the commit).
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setVisible(true));
        rafRef.current = raf2;
      });
      rafRef.current = raf1;
      return () => cancelAnimationFrame(rafRef.current);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 150); // matches close duration below
    return () => clearTimeout(t);
  }, [open]);

  const { messages, clear, streaming, itemCache, send: sendMessage } = useChat(() =>
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight }),
  );

  function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setOpen(true);
    setInput("");
    sendMessage(text);
  }

  return (
    <div className="z-assistant fixed inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:pb-6">
      <div className="w-full max-w-xl">
        {mounted && (
          <Card
            className={cn(
              "mb-2 flex max-h-[50vh] flex-col origin-bottom overflow-hidden bg-popover/95 not-dark:bg-clip-padding backdrop-blur transition-[opacity,transform] ease-[var(--ease-smooth-out)]",
              visible
                ? "scale-100 opacity-100 duration-[var(--duration-fast)]"
                : "scale-[var(--scale-large)] opacity-0 duration-[var(--duration-quick)]",
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-muted-foreground text-xs font-medium">
                AI 收藏助手
              </span>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clear}
                  >
                    新对话
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="收起"
                  onClick={() => setOpen(false)}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="space-y-1 pt-2 text-muted-foreground text-sm">
                  <p>说说你在找什么，我从收藏里帮你挑。</p>
                  <p className="text-muted-foreground/72">
                    例如："Vue3 项目要一个流程图库，支持节点拖拽"
                  </p>
                </div>
              )}
              {messages.map((m, i) => {
                if (m.role === "user") {
                  return (
                    <div
                      key={i}
                      className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm"
                    >
                      {m.content}
                    </div>
                  );
                }
                const refIds = [...new Set(extractRefIds(m.content))];
                return (
                  <div
                    key={i}
                    className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm [&_a]:underline [&_code]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-2"
                  >
                    {m.content ? (
                      <Streamdown>{renderableText(m.content, itemCache)}</Streamdown>
                    ) : streaming ? (
                      "…"
                    ) : (
                      ""
                    )}
                    {refIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {refIds.map(
                          (id) =>
                            itemCache[id] && (
                              <a
                                key={id}
                                href={itemCache[id].url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs no-underline hover:bg-accent"
                              >
                                <Favicon
                                  url={itemCache[id].url}
                                  name={itemCache[id].name}
                                />
                                {itemCache[id].name}
                              </a>
                            ),
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          onClick={() => inputRef.current?.focus()}
          className={cn(
            "flex items-center gap-2 rounded-full border bg-popover/95 not-dark:bg-clip-padding px-4 py-2.5 shadow-lg/10 ring-ring/24 backdrop-blur transition-shadow",
            "focus-within:border-ring focus-within:ring-[3px]",
          )}
        >
          <SparkleIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => messages.length > 0 && setOpen(true)}
            placeholder="问点什么，比如「找个能做流程图的库」…"
            disabled={streaming}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/72 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon-xs"
            className="rounded-full"
            disabled={streaming || !input.trim()}
            aria-label="发送"
          >
            <ArrowUpIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}
