// Next run time of a 5-field cron expression (minute hour day-of-month month
// day-of-week), in UTC like Cloudflare's cron triggers. Supports "*", numbers,
// lists ("1,15"), ranges ("1-5") and steps ("*/10"); enough for wrangler's
// triggers, not a full cron implementation (no names like "MON").

const RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week (0 = Sunday)
];

function parseField(field: string, [min, max]: [number, number]): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    let [from, to] = [min, max];
    if (range !== "*") {
      const [a, b] = range.split("-").map(Number);
      [from, to] = [a, b ?? (stepText ? max : a)];
    }
    if (![from, to, step].every(Number.isInteger) || step < 1) throw new Error(`bad cron field: ${field}`);
    for (let v = from; v <= to; v += step) values.add(v === 7 && max === 6 ? 0 : v);
  }
  return values;
}

/** The first time strictly after `from` (ms) that matches `expr`; null if none within a year. */
export function nextRun(expr: string, from: number): number | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`bad cron expression: ${expr}`);
  const [minutes, hours, days, months, weekdays] = fields.map((f, i) => parseField(f, RANGES[i]));
  // Cron ORs day-of-month and day-of-week when both are restricted.
  const domAny = fields[2] === "*";
  const dowAny = fields[4] === "*";

  const t = new Date(from);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  const limit = from + 366 * 24 * 60 * 60 * 1000;
  while (t.getTime() <= limit) {
    const dayOk =
      domAny && dowAny
        ? true
        : domAny
          ? weekdays.has(t.getUTCDay())
          : dowAny
            ? days.has(t.getUTCDate())
            : days.has(t.getUTCDate()) || weekdays.has(t.getUTCDay());
    if (!months.has(t.getUTCMonth() + 1) || !dayOk) {
      // Skip to the next day.
      t.setUTCHours(24, 0, 0, 0);
    } else if (!hours.has(t.getUTCHours())) {
      t.setUTCHours(t.getUTCHours() + 1, 0, 0, 0);
    } else if (!minutes.has(t.getUTCMinutes())) {
      t.setUTCMinutes(t.getUTCMinutes() + 1);
    } else {
      return t.getTime();
    }
  }
  return null;
}
