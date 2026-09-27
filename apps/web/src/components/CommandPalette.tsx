import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { m } from "#lib/i18n";
import { itemsQuery } from "#lib/items-query";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

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

  // Shares the item list (and its on-disk copy) with the items page.
  const items = useQuery({ ...itemsQuery, enabled: open }).data ?? null;

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
          {/* The input sits above the panel: inside it, the list would be sized to
              the whole panel and pushed down by the input, clipping its end. */}
          <CommandInput placeholder={m.palette_placeholder()} />
          <CommandPanel>
            <CommandList>
              <CommandEmpty>
                {items === null ? m.common_loading() : m.palette_empty()}
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
            <span>{m.palette_hint_select()}</span>
            <CommandShortcut>{m.palette_hint_keys()}</CommandShortcut>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
