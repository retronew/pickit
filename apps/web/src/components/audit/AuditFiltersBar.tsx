import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { debounce } from "es-toolkit";
import { Input } from "#components/ui/input";
import { DateRangePicker } from "#components/DateRangePicker";
import { Button } from "#components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { AUDIT_CATEGORIES, actionCategory, actionLabel } from "#lib/audit";
import { EMPTY_FILTERS, type AuditFilters } from "#hooks/useAuditLog";

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
      <SelectTrigger size="sm" className="w-auto min-w-28 bg-background">
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
  const set = (patch: Partial<AuditFilters>) => onChange({ ...filters, ...patch });

  // Keyword typing is debounced; everything else applies immediately.
  const [keyword, setKeyword] = useState(filters.q);
  useEffect(() => setKeyword(filters.q), [filters.q]);
  const [applyKeyword] = useState(() => debounce((fn: () => void) => fn(), 300));

  const actionItems = Object.fromEntries(
    actions
      .filter((a) => !filters.category || actionCategory(a.value) === filters.category)
      .map((a) => [a.value, `${actionLabel(a.value)}（${a.count}）`]),
  );
  const actorItems = Object.fromEntries(actors.map((a) => [a.value, `${a.value}（${a.count}）`]));
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        size="sm"
        className="w-full sm:w-56"
        placeholder="搜索描述、对象或 IP"
        value={keyword}
        onChange={(e) => {
          const q = e.target.value;
          setKeyword(q);
          applyKeyword(() => set({ q }));
        }}
      />
      <FilterSelect
        label="全部类别"
        value={filters.category}
        items={AUDIT_CATEGORIES}
        onChange={(category) => set({ category, action: "" })}
      />
      <FilterSelect
        label="全部动作"
        value={filters.action}
        items={actionItems}
        onChange={(action) => set({ action })}
      />
      <FilterSelect
        label="全部操作者"
        value={filters.actor}
        items={actorItems}
        onChange={(actor) => set({ actor })}
      />
      <FilterSelect
        label="全部结果"
        value={filters.result}
        items={{ ok: "成功", error: "失败" }}
        onChange={(result) => set({ result: result as AuditFilters["result"] })}
      />
      <DateRangePicker
        from={filters.from}
        to={filters.to}
        onChange={(range) => set(range)}
        placeholder="全部时间"
      />
      {dirty && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <XIcon />
          清除筛选
        </Button>
      )}
    </div>
  );
}
