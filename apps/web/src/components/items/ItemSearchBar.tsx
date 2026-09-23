import { SearchIcon, PlusIcon, ChevronDownIcon, ListPlusIcon, XIcon } from "lucide-react";
import { Spinner } from "#components/ui/spinner";
import { Input } from "#components/ui/input";
import { Button, buttonVariants } from "#components/ui/button";
import { Kbd } from "#components/ui/kbd";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "#components/ui/menu";
import { cn } from "#lib/utils";
import { m } from "#lib/i18n";

export function ItemSearchBar({
  query,
  onQueryChange,
  searching,
  onAdd,
  onBatchAdd,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  searching: boolean;
  onAdd: () => void;
  onBatchAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        {searching ? (
          <Spinner className="z-raised pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <SearchIcon className="z-raised pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          size="lg"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={m.search_placeholder()}
          aria-busy={searching}
          className="pl-7 pr-14"
        />
        {query ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.search_clear()}
            onClick={() => onQueryChange("")}
            className="z-raised absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          >
            <XIcon />
          </Button>
        ) : (
          <Kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            ⌘K
          </Kbd>
        )}
      </div>
      <div className="flex">
        <Button size="lg" onClick={onAdd} className="rounded-e-none">
          <PlusIcon />
          {m.action_add()}
        </Button>
        <Menu>
          <MenuTrigger
            className={cn(
              buttonVariants({ size: "lg" }),
              "-ms-px w-auto rounded-s-none px-2",
            )}
            aria-label={m.add_more()}
          >
            <ChevronDownIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={onAdd}>
              <PlusIcon />
              {m.add_single()}
            </MenuItem>
            <MenuItem onClick={onBatchAdd}>
              <ListPlusIcon />
              {m.add_batch()}
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}
