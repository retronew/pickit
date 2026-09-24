import { useEffect, useState } from "react";
import { ListFilterIcon, XIcon } from "lucide-react";
import { Badge } from "#components/ui/badge";
import { debounce } from "es-toolkit";
import { Input } from "#components/ui/input";
import { DateRangePicker } from "#components/DateRangePicker";
import { Button } from "#components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "#components/ui/select";
import {
  AUDIT_CATEGORIES,
  actionCategory,
  actionLabel,
  actorLabel,
  categoryLabel,
} from "#lib/audit";
import { EMPTY_FILTERS, type AuditFilters } from "#hooks/useAuditLog";
import { m } from "#lib/i18n";

export interface Facet {
  value: string;
  count: number;
}

const ALL = "__all__";

function FilterSelect({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Record<string, string>;
  label: string;
}) {
  const withAll = { [ALL]: label, ...items };
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL || v == null ? "" : String(v))}
      items={withAll}
    >
      <SelectTrigger
        size="sm"
        className="bg-background max-sm:w-full sm:w-auto sm:min-w-28"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {Object.entries(withAll).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

export function AuditFiltersBar({
  filters,
  onChange,
  actions,
  actors,
}: {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
  actions: Facet[];
  actors: Facet[];
}) {
  const set = (patch: Partial<AuditFilters>) =>
    onChange({ ...filters, ...patch });

  // Keyword typing is debounced; everything else applies immediately.
  const [keyword, setKeyword] = useState(filters.q);
  useEffect(() => setKeyword(filters.q), [filters.q]);
  const [applyKeyword] = useState(() =>
    debounce((fn: () => void) => fn(), 300),
  );

  const actionItems = Object.fromEntries(
    actions
      .filter(
        (a) =>
          !filters.category || actionCategory(a.value) === filters.category,
      )
      .map((a) => [
        a.value,
        m.facet_count({ label: actionLabel(a.value), count: a.count }),
      ]),
  );
  const actorItems = Object.fromEntries(
    actors.map((a) => [
      a.value,
      m.facet_count({ label: actorLabel(a.value), count: a.count }),
    ]),
  );
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  // Filters other than the keyword; on phones they sit behind a toggle.
  const activeCount = [
    filters.category,
    filters.action,
    filters.actor,
    filters.result,
    filters.from || filters.to,
  ].filter(Boolean).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex w-full gap-2 sm:contents">
        <Input
          size="sm"
          className="min-w-0 flex-1 sm:w-56 sm:flex-none"
          placeholder={m.audit_search_placeholder()}
          value={keyword}
          onChange={(e) => {
            const q = e.target.value;
            setKeyword(q);
            applyKeyword(() => set({ q }));
          }}
        />
        <Button
          variant={expanded ? "secondary" : "outline"}
          size="sm"
          className="shrink-0 sm:hidden"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ListFilterIcon />
          {m.audit_filters()}
          {activeCount > 0 && <Badge size="sm">{activeCount}</Badge>}
        </Button>
      </div>
      <div
        className={
          expanded
            ? "grid w-full grid-cols-2 gap-2 sm:contents"
            : "hidden sm:contents"
        }
      >
        <FilterSelect
          label={m.audit_all_categories()}
          value={filters.category}
          items={Object.fromEntries(
            AUDIT_CATEGORIES.map((c) => [c, categoryLabel(c)]),
          )}
          onChange={(category) => set({ category, action: "" })}
        />
        <FilterSelect
          label={m.audit_all_actions()}
          value={filters.action}
          items={actionItems}
          onChange={(action) => set({ action })}
        />
        <FilterSelect
          label={m.audit_all_actors()}
          value={filters.actor}
          items={actorItems}
          onChange={(actor) => set({ actor })}
        />
        <FilterSelect
          label={m.audit_all_results()}
          value={filters.result}
          items={{ ok: m.audit_ok(), error: m.audit_failed() }}
          onChange={(result) =>
            set({ result: result as AuditFilters["result"] })
          }
        />
        <DateRangePicker
          from={filters.from}
          to={filters.to}
          onChange={(range) => set(range)}
          placeholder={m.audit_all_time()}
        />
      </div>
      {dirty && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <XIcon />
          {m.audit_clear_filters()}
        </Button>
      )}
    </div>
  );
}
