import type { DateRange } from "@daypicker/react";
import { zhCN } from "@daypicker/react/locale/zh-CN";
import { enUS } from "@daypicker/react/locale/en-US";
import { ja } from "@daypicker/react/locale/ja";
import { CalendarIcon, XIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Calendar } from "#components/ui/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "#components/ui/popover";
import { cn } from "#lib/utils";
import { m, getLocale, intlLocale } from "#lib/i18n";

const CALENDAR_LOCALES = { zh: zhCN, en: enUS, ja };

/** yyyy-mm-dd in local time ⇄ Date. */
function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function toValue(date: Date | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const label = new Intl.DateTimeFormat(intlLocale(), { year: "numeric", month: "short", day: "numeric" });

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const PRESETS: { label: () => string; from: () => Date }[] = [
  { label: () => m.date_today(), from: () => daysAgo(0) },
  { label: () => m.date_last_days({ days: 7 }), from: () => daysAgo(6) },
  { label: () => m.date_last_days({ days: 30 }), from: () => daysAgo(29) },
];

/** Date range picker; `from` / `to` are yyyy-mm-dd strings ("" = open-ended). */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = m.date_pick_range(),
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const selected: DateRange | undefined = from ? { from: toDate(from), to: toDate(to) } : undefined;

  return (
    <div className={cn("flex items-center", className)}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn("justify-start font-normal", from && "rounded-e-none")}
            />
          }
        >
          <CalendarIcon aria-hidden="true" />
          {selected?.from ? (
            selected.to && to !== from ? (
              <>
                {label.format(selected.from)} – {label.format(selected.to)}
              </>
            ) : (
              label.format(selected.from)
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverPopup className="w-auto">
          <div className="mb-2 flex gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.label()}
                size="xs"
                variant="secondary"
                onClick={() => onChange({ from: toValue(p.from()), to: toValue(daysAgo(0)) })}
              >
                {p.label()}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            locale={CALENDAR_LOCALES[getLocale()]}
            numberOfMonths={2}
            defaultMonth={selected?.from ?? daysAgo(30)}
            disabled={{ after: new Date() }}
            selected={selected}
            onSelect={(range) => onChange({ from: toValue(range?.from), to: toValue(range?.to) })}
          />
        </PopoverPopup>
      </Popover>
      {from && (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={m.date_clear()}
          className="-ms-px rounded-s-none"
          onClick={() => onChange({ from: "", to: "" })}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
