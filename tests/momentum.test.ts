import { describe, expect, it } from "vitest";
import { isRecentWin, momentum, peopleLine } from "@/lib/momentum";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);
const base = { status: "open", createdAt: daysFromNow(-30), joinedThisWeek: 0 };

describe("momentum label on a cause", () => {
  it("a win beats everything", () => {
    const m = momentum({ ...base, status: "resolved", resolvedAt: daysFromNow(-2), nextMeetup: { startsAt: daysFromNow(1) } }, now);
    expect(m).toEqual({ kind: "won", at: daysFromNow(-2) });
  });

  it("a meetup in the next two weeks comes next", () => {
    const m = momentum({ ...base, nextMeetup: { startsAt: daysFromNow(3) }, campaign: { signed: 5, goal: 100 } }, now);
    expect(m).toEqual({ kind: "meeting", startsAt: daysFromNow(3) });
  });

  it("a meetup further away doesn't count; the campaign shows instead", () => {
    const m = momentum({ ...base, nextMeetup: { startsAt: daysFromNow(30) }, campaign: { signed: 48, goal: 150 } }, now);
    expect(m).toEqual({ kind: "asking", signed: 48, goal: 150 });
  });

  it("then new supporters this week", () => {
    expect(momentum({ ...base, joinedThisWeek: 3 }, now)).toEqual({ kind: "growing", joinedThisWeek: 3 });
  });

  it("then brand new causes", () => {
    expect(momentum({ ...base, createdAt: daysFromNow(-2) }, now)).toEqual({ kind: "new" });
  });

  it("quiet causes get no label", () => {
    expect(momentum(base, now)).toBeNull();
  });
});

describe("recent wins", () => {
  it("count for 30 days", () => {
    expect(isRecentWin(daysFromNow(-29), now)).toBe(true);
    expect(isRecentWin(daysFromNow(-31), now)).toBe(false);
    expect(isRecentWin(null, now)).toBe(false);
  });
});

describe("who cares, in words", () => {
  it("reads naturally for small and large groups", () => {
    expect(peopleLine([], 0)).toBe("Be the first to care");
    expect(peopleLine(["Priya"], 1)).toBe("Priya cares");
    expect(peopleLine(["Priya", "Sam"], 2)).toBe("Priya and Sam care");
    expect(peopleLine(["Priya", "Sam"], 3)).toBe("Priya, Sam and 1 neighbour care");
    expect(peopleLine(["Priya", "Sam", "Ana"], 3)).toBe("Priya, Sam and Ana care");
    expect(peopleLine(["Priya", "Sam", "Ana"], 14)).toBe("Priya, Sam and 12 neighbours care");
  });

  it("can say 'joined' instead of 'care' for a cause's own page", () => {
    expect(peopleLine([], 0, "joined")).toBe("Be the first to join");
    expect(peopleLine(["Priya"], 1, "joined")).toBe("Priya has joined");
    expect(peopleLine(["Priya", "Sam", "Ana"], 14, "joined")).toBe("Priya, Sam and 12 neighbours have joined");
  });

  it("copes when some supporters have left and can't be named", () => {
    expect(peopleLine(["Priya"], 2)).toBe("Priya and 1 other care");
    expect(peopleLine(["Priya"], 5)).toBe("Priya and 4 neighbours care");
    expect(peopleLine([], 3)).toBe("3 neighbours care");
    expect(peopleLine([], 1)).toBe("1 neighbour cares");
  });
});
