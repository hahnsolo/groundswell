import { describe, expect, it } from "vitest";
import { announcementsLeft, buildBundles, splitByBudget } from "@/lib/announcements";

const person = (id: string) => ({ id });
const at = (s: string) => new Date(`2026-11-0${s}T12:00:00Z`);

describe("the weekly cap (#73)", () => {
  it("allows 3 a week", () => {
    expect(announcementsLeft(0)).toBe(3);
    expect(announcementsLeft(2)).toBe(1);
    expect(announcementsLeft(3)).toBe(0);
    expect(announcementsLeft(9)).toBe(0);
  });
});

describe("one email per person (#73)", () => {
  const a1 = { id: "a1", createdAt: at("1") };
  const a2 = { id: "a2", createdAt: at("2") };

  it("bundles someone's announcements and reminders into one", () => {
    const bundles = buildBundles(
      [{ user: person("maya"), reminder: "Tomorrow: meeting" }],
      [
        { user: person("maya"), announcement: a2 },
        { user: person("maya"), announcement: a1 },
      ],
    );
    expect(bundles).toHaveLength(1);
    expect(bundles[0].reminders).toEqual(["Tomorrow: meeting"]);
    expect(bundles[0].announcements.map((a) => a.id)).toEqual(["a1", "a2"]); // oldest first
  });

  it("gives each person their own", () => {
    const bundles = buildBundles<{ id: string }, string, typeof a1>([], [
      { user: person("maya"), announcement: a1 },
      { user: person("dev"), announcement: a1 },
    ]);
    expect(bundles.map((b) => b.user.id).sort()).toEqual(["dev", "maya"]);
  });

  it("puts reminders first, then whoever's waited longest", () => {
    const bundles = buildBundles(
      [{ user: person("reminded"), reminder: "r" }],
      [
        { user: person("newer"), announcement: a2 },
        { user: person("older"), announcement: a1 },
      ],
    );
    expect(bundles.map((b) => b.user.id)).toEqual(["reminded", "older", "newer"]);
  });
});

describe("past the budget (#73)", () => {
  it("carries the rest over to the next morning", () => {
    expect(splitByBudget(["a", "b", "c"], 2)).toEqual({ send: ["a", "b"], carry: ["c"] });
    expect(splitByBudget(["a"], 0)).toEqual({ send: [], carry: ["a"] });
    expect(splitByBudget(["a"], 5)).toEqual({ send: ["a"], carry: [] });
  });
});
