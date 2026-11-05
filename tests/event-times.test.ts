import { describe, expect, it } from "vitest";
import { defaultEnd, endProblem, eventState } from "@/lib/event-times";

const start = new Date("2026-11-20T23:00:00Z");
const hours = (n: number) => new Date(start.getTime() + n * 60 * 60 * 1000);

describe("event end times", () => {
  it("suggests an end two hours after the start", () => {
    expect(defaultEnd(start)).toEqual(hours(2));
  });

  it("needs the end after the start", () => {
    expect(endProblem(start, hours(1))).toBeNull();
    expect(endProblem(start, start)).toMatch(/after the start/);
    expect(endProblem(start, hours(-1))).toMatch(/after the start/);
  });

  it("allows events up to 3 days long", () => {
    expect(endProblem(start, hours(72))).toBeNull();
    expect(endProblem(start, hours(73))).toMatch(/up to 3 days/);
  });

  it("is upcoming, then on, then over", () => {
    const end = hours(2);
    expect(eventState(start, end, hours(-1).getTime())).toBe("upcoming");
    expect(eventState(start, end, start.getTime())).toBe("on");
    expect(eventState(start, end, hours(1.9).getTime())).toBe("on");
    expect(eventState(start, end, end.getTime())).toBe("over");
  });
});
