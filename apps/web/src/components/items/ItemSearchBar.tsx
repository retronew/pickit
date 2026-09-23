import { SearchIcon, PlusIcon, ChevronDownIcon, ListPlusIcon, XIcon } from "lucide-react";
import { Spinner } from "#components/ui/spinner";
import { Input } from "#components/ui/input";
import { Button, buttonVariants } from "#components/ui/button";
import { Kbd } from "#components/ui/kbd";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "#components/ui/menu";
import { cn } from "#lib/utils";

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
          placeholder="搜索收藏，也可以直接描述你在找什么…"
          aria-busy={searching}
          className="pl-7 pr-14"
        />
        {query ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="清空搜索"
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
          添加
        </Button>
        <Menu>
          <MenuTrigger
            className={cn(
              buttonVariants({ size: "lg" }),
              "-ms-px w-auto rounded-s-none px-2",
            )}
            aria-label="更多添加方式"
          >
            <ChevronDownIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={onAdd}>
              <PlusIcon />
              单个添加
            </MenuItem>
            <MenuItem onClick={onBatchAdd}>
              <ListPlusIcon />
              批量粘贴网址
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}
