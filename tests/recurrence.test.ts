import { describe, expect, it } from "vitest";
import { fromLocal, localParts, MAX_OCCURRENCES, nextOfEachSeries, nthWeekday, occurrences, validTimeZone } from "@/lib/recurrence";

const TO = "America/Toronto";
const wall = (d: Date, tz = TO) => {
  const p = localParts(d, tz);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const seven = (y: number, m: number, d: number) => fromLocal({ y, m, d, hour: 19, minute: 0 }, TO);

describe("generating dates (#78)", () => {
  it("weekly stays on the weekday, and every 2 weeks skips one", () => {
    const start = seven(2026, 10, 3); // Tue Nov 3
    expect(occurrences(start, "weekly", TO, { count: 3 }).map((d) => wall(d))).toEqual(["2026-11-03 19:00", "2026-11-10 19:00", "2026-11-17 19:00"]);
    expect(occurrences(start, "biweekly", TO, { count: 3 }).map((d) => wall(d))).toEqual(["2026-11-03 19:00", "2026-11-17 19:00", "2026-12-01 19:00"]);
  });

  it("stays at 7pm on the wall when the clocks change", () => {
    const start = seven(2026, 9, 27); // Oct 27, before clocks go back on Nov 1
    const dates = occurrences(start, "weekly", TO, { count: 2 });
    expect(wall(dates[1])).toBe("2026-11-03 19:00");
    expect(dates[1].getTime() - dates[0].getTime()).toBe(7 * 24 * 3600 * 1000 + 3600 * 1000); // a 169-hour week
    const spring = occurrences(seven(2027, 2, 9), "weekly", TO, { count: 2 }); // clocks go forward Mar 14
    expect(wall(spring[1])).toBe("2027-03-16 19:00");
  });

  it("monthly keeps the same weekday: the 2nd Tuesday stays the 2nd Tuesday, across the year end", () => {
    const start = seven(2026, 10, 10); // 2nd Tuesday of November
    expect(occurrences(start, "monthly", TO, { count: 4 }).map((d) => wall(d))).toEqual(["2026-11-10 19:00", "2026-12-08 19:00", "2027-01-12 19:00", "2027-02-09 19:00"]);
  });

  it("uses the last one when a month doesn't have a 5th", () => {
    const start = seven(2026, 8, 29); // 5th Tuesday of September 2026
    expect(occurrences(start, "monthly", TO, { count: 3 }).map((d) => wall(d))).toEqual(["2026-09-29 19:00", "2026-10-27 19:00", "2026-11-24 19:00"]);
    expect(nthWeekday(2027, 1, 0, 5)).toBe(28); // February 2027 has only 4 Sundays
  });

  it("stops on the until day, that day included", () => {
    const start = seven(2026, 10, 3);
    expect(occurrences(start, "weekly", TO, { until: "2026-11-17" }).map((d) => wall(d))).toEqual(["2026-11-03 19:00", "2026-11-10 19:00", "2026-11-17 19:00"]);
    expect(occurrences(start, "weekly", TO, { until: "2026-11-16" })).toHaveLength(2);
  });

  it("never makes more than the most allowed", () => {
    expect(occurrences(seven(2026, 10, 3), "weekly", TO, { count: 500 })).toHaveLength(MAX_OCCURRENCES);
    expect(occurrences(seven(2026, 10, 3), "weekly", TO, { until: "2099-01-01" })).toHaveLength(MAX_OCCURRENCES);
  });

  it("the first is exactly the time chosen", () => {
    const start = new Date("2026-11-03T23:59:00Z");
    expect(occurrences(start, "weekly", "Asia/Tokyo", { count: 2 })[0]).toBe(start);
    expect(wall(occurrences(start, "weekly", "Asia/Tokyo", { count: 2 })[1], "Asia/Tokyo")).toBe("2026-11-11 08:59");
  });

  it("only trusts real time zones", () => {
    expect(validTimeZone("America/St_Johns")).toBe("America/St_Johns");
    expect(validTimeZone("Not/AZone")).toBeNull();
    expect(validTimeZone(undefined)).toBeNull();
  });
});

describe("lists (#78)", () => {
  it("shows the next few of each series, and says how many more", () => {
    const e = (id: string, seriesId: string | null) => ({ id, seriesId });
    const { shown, more } = nextOfEachSeries([e("a1", "a"), e("x", null), e("a2", "a"), e("b1", "b"), e("a3", "a"), e("a4", "a")], 2);
    expect(shown.map((s) => s.id)).toEqual(["a1", "x", "a2", "b1"]);
    expect(more.get("a")).toBe(2);
    expect(more.has("b")).toBe(false);
  });
});
