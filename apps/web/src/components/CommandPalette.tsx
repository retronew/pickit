import { useEffect, useState } from "react";
import type { Item } from "@pickit/shared";
import {
  CommandDialog,
  CommandDialogPopup,
  Command,
  CommandInput,
  CommandPanel,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandFooter,
  CommandShortcut,
} from "#components/ui/command";
import { Favicon } from "#components/Favicon";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open && items === null) {
      fetch("/api/items")
        .then((r) => r.json())
        .then(setItems);
    }
  }, [open, items]);

  function openItem(item: Item) {
    window.open(item.url, "_blank", "noreferrer");
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogPopup>
        <Command
          items={items ?? []}
          itemToStringValue={(i: unknown) => (i as Item).name}
        >
          <CommandPanel>
            <CommandInput placeholder="搜索收藏，回车打开…" />
            <CommandList>
              <CommandEmpty>
                {items === null ? "加载中…" : "没找到相关收藏"}
              </CommandEmpty>
              {(items ?? []).map((item) => (
                <CommandItem
                  key={item.id}
                  value={item}
                  onClick={() => openItem(item)}
                >
                  <Favicon url={item.url} name={item.name} />
                  <span className="ml-2 min-w-0 truncate">{item.name}</span>
                  {item.category && (
                    <span className="ml-auto shrink-0 pl-2 text-muted-foreground text-xs">
                      {item.category}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <span>↑↓ 选择</span>
            <CommandShortcut>Enter 打开 · Esc 关闭</CommandShortcut>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
