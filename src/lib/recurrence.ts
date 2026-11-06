// Recurring events (#78): working out the dates. "Every second Tuesday at 7"
// stays at 7 in the host's own time zone, even when the clocks change, so the
// arithmetic is done on local dates and turned back into exact times.
// Pure, so it's easy to test.

export const REPEATS = { weekly: "every week", biweekly: "every 2 weeks", monthly: "every month" } as const;
export type Repeat = keyof typeof REPEATS;
export const isRepeat = (v: unknown): v is Repeat => typeof v === "string" && v in REPEATS;

export const MAX_OCCURRENCES = 26;

type Local = { y: number; m: number; d: number; hour: number; minute: number };

/** The date and time on the wall in a time zone. m is 0-11. */
export function localParts(at: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month") - 1, d: get("day"), hour: get("hour"), minute: get("minute") };
}

/** The exact time for a date and time on the wall in a time zone. */
export function fromLocal(local: Local, timeZone: string) {
  const wanted = Date.UTC(local.y, local.m, local.d, local.hour, local.minute);
  let guess = wanted;
  // Twice: the offset can differ on either side of a clock change.
  for (let i = 0; i < 2; i++) {
    const seen = localParts(new Date(guess), timeZone);
    guess += wanted - Date.UTC(seen.y, seen.m, seen.d, seen.hour, seen.minute);
  }
  return new Date(guess);
}

const weekdayOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).getUTCDay();
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** The nth such weekday of a month, or the last one if the month doesn't have an nth (a 5th Tuesday). */
export function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = 1 + ((weekday - weekdayOf(y, m, 1) + 7) % 7);
  const day = first + (n - 1) * 7;
  return day <= daysIn(y, m) ? day : day - 7;
}

/**
 * The start of every occurrence, the first included. It stops after `count`
 * times or on the `until` day ("2027-03-31", in the host's time zone), and
 * never makes more than MAX_OCCURRENCES.
 */
export function occurrences(start: Date, repeat: Repeat, timeZone: string, end: { count?: number; until?: string }) {
  const first = localParts(start, timeZone);
  const limit = Math.min(end.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const weekday = weekdayOf(first.y, first.m, first.d);
  const nth = Math.ceil(first.d / 7);
  const stopDay = end.until ? Date.UTC(Number(end.until.slice(0, 4)), Number(end.until.slice(5, 7)) - 1, Number(end.until.slice(8, 10))) : Infinity;

  const out: Date[] = [];
  for (let i = 0; out.length < limit; i++) {
    let y = first.y;
    let m = first.m;
    let d = first.d;
    if (repeat === "monthly") {
      const total = first.m + i;
      y = first.y + Math.floor(total / 12);
      m = ((total % 12) + 12) % 12;
      d = nthWeekday(y, m, weekday, nth);
    } else {
      const next = new Date(Date.UTC(first.y, first.m, first.d + i * (repeat === "weekly" ? 7 : 14)));
      y = next.getUTCFullYear();
      m = next.getUTCMonth();
      d = next.getUTCDate();
    }
    if (Date.UTC(y, m, d) > stopDay) break;
    out.push(i === 0 ? start : fromLocal({ y, m, d, hour: first.hour, minute: first.minute }, timeZone));
  }
  return out;
}

/** A time zone the browser sent, if it's a real one. */
export function validTimeZone(tz: unknown) {
  if (typeof tz !== "string" || !tz || tz.length > 60) return null;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Lists show the next few of each series, not months of the same meeting. Keeps the order. */
export function nextOfEachSeries<T extends { seriesId: string | null }>(events: T[], perSeries: number) {
  const seen = new Map<string, number>();
  const shown: T[] = [];
  for (const e of events) {
    if (!e.seriesId) {
      shown.push(e);
      continue;
    }
    const n = seen.get(e.seriesId) ?? 0;
    seen.set(e.seriesId, n + 1);
    if (n < perSeries) shown.push(e);
  }
  const more = new Map([...seen].filter(([, n]) => n > perSeries).map(([id, n]) => [id, n - perSeries]));
  return { shown, more };
}
