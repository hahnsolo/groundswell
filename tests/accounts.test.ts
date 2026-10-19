import { describe, expect, it } from "vitest";
import {
  ACCOUNT_GRACE_DAYS,
  anonymizeCutoff,
  anonymizeDate,
  anonymizedEmail,
  displayName,
  FORMER_MEMBER,
  pickNewHost,
} from "@/lib/accounts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-19T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe("deleted accounts: grace period", () => {
  it("is 30 days", () => {
    expect(ACCOUNT_GRACE_DAYS).toBe(30);
  });

  it("anonymizes only accounts deleted more than 30 days ago", () => {
    const cutoff = anonymizeCutoff(now);
    expect(daysAgo(31) < cutoff).toBe(true); // anonymized
    expect(daysAgo(29) < cutoff).toBe(false); // can still come back
  });

  it("anonymizes exactly 30 days after deleting", () => {
    expect(anonymizeDate(now)).toEqual(new Date("2026-11-18T12:00:00Z"));
  });
});

describe("deleted accounts: what others see", () => {
  it("hides the name of anyone who has left", () => {
    expect(displayName({ name: "Sam", deactivatedAt: null })).toBe("Sam");
    expect(displayName({ name: "Sam" })).toBe("Sam");
    expect(displayName({ name: "Sam", deactivatedAt: now })).toBe(FORMER_MEMBER);
  });

  it("replaces the email with a unique address that can't receive mail", () => {
    expect(anonymizedEmail("abc123")).toBe("deleted-abc123@deleted.invalid");
    expect(anonymizedEmail("a")).not.toBe(anonymizedEmail("b"));
  });
});

describe("meetup handover", () => {
  const rsvp = (userId: string, minutesAfter: number, active = true) => ({
    userId,
    active,
    createdAt: new Date(now.getTime() + minutesAfter * 60_000),
  });

  it("passes to the earliest RSVP who isn't the leaving host", () => {
    const rsvps = [rsvp("host", 0), rsvp("priya", 30), rsvp("sam", 10)];
    expect(pickNewHost(rsvps, "host")).toBe("sam");
  });

  it("skips people who have deleted their account", () => {
    const rsvps = [rsvp("host", 0), rsvp("sam", 10, false), rsvp("priya", 30)];
    expect(pickNewHost(rsvps, "host")).toBe("priya");
  });

  it("returns nobody when the host was the only one going (so it's cancelled)", () => {
    expect(pickNewHost([rsvp("host", 0)], "host")).toBeNull();
    expect(pickNewHost([], "host")).toBeNull();
  });
});
