import { describe, expect, it } from "vitest";
import {
  budgetLeft,
  checkUnsubscribe,
  DAILY_NOTIFY_BUDGET,
  digestSince,
  prefsOff,
  reminderWindow,
  startOfBudgetDay,
  unsubscribeToken,
  wants,
} from "@/lib/notify-rules";

const defaults = { notifyEvents: true, notifyWinCheck: true, notifyWins: true, notifyNewMembers: true, notifyChatDigest: false };

describe("who gets which email", () => {
  it("uses the defaults: everything on except the chat summary", () => {
    expect(wants(defaults, "event_tomorrow")).toBe(true);
    expect(wants(defaults, "win_check")).toBe(true);
    expect(wants(defaults, "won")).toBe(true);
    expect(wants(defaults, "new_members")).toBe(true);
    expect(wants(defaults, "chat_digest")).toBe(false);
  });

  it("respects each setting", () => {
    expect(wants({ ...defaults, notifyEvents: false }, "event_tomorrow")).toBe(false);
    expect(wants({ ...defaults, notifyChatDigest: true }, "chat_digest")).toBe(true);
  });

  it("sends nothing about a muted cause, to deactivated accounts or to unconfirmed emails", () => {
    expect(wants(defaults, "won", true)).toBe(false);
    expect(wants({ ...defaults, deactivatedAt: new Date() }, "won")).toBe(false);
    expect(wants({ ...defaults, emailVerified: false }, "won")).toBe(false);
  });
});

describe("when", () => {
  const now = new Date("2026-11-05T09:00:00Z");

  it("reminds about events starting 12 to 36 hours after the daily job", () => {
    const { from, to } = reminderWindow(now);
    expect(from.toISOString()).toBe("2026-11-05T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-06T21:00:00.000Z");
  });

  it("summarizes the last 24 hours", () => expect(digestSince(now).toISOString()).toBe("2026-11-04T09:00:00.000Z"));
});

describe("the daily budget", () => {
  it("leaves room for sign-in emails within Resend's 100 a day", () => expect(DAILY_NOTIFY_BUDGET).toBeLessThanOrEqual(70));

  it("stops at the limit, never below zero", () => {
    expect(budgetLeft(0)).toBe(DAILY_NOTIFY_BUDGET);
    expect(budgetLeft(DAILY_NOTIFY_BUDGET)).toBe(0);
    expect(budgetLeft(DAILY_NOTIFY_BUDGET + 5)).toBe(0);
  });

  it("resets at midnight UTC", () => expect(startOfBudgetDay(new Date("2026-11-05T23:59:00Z")).toISOString()).toBe("2026-11-05T00:00:00.000Z"));
});

describe("unsubscribe links", () => {
  const secret = "test-secret";

  it("accept the right token for that person and kind only", () => {
    const t = unsubscribeToken("u1", "won", secret);
    expect(checkUnsubscribe("u1", "won", t, secret)).toBe(true);
    expect(checkUnsubscribe("u2", "won", t, secret)).toBe(false);
    expect(checkUnsubscribe("u1", "event_tomorrow", t, secret)).toBe(false);
    expect(checkUnsubscribe("u1", "won", t, "other-secret")).toBe(false);
    expect(checkUnsubscribe("u1", "won", "nonsense", secret)).toBe(false);
    expect(checkUnsubscribe("u1", "made_up", t, secret)).toBe(false);
    expect(checkUnsubscribe("u1", "won", t, "")).toBe(false);
  });

  it("turn off one kind, or all of them", () => {
    expect(prefsOff("won")).toEqual({ notifyWins: false });
    expect(prefsOff("all")).toEqual({ notifyEvents: false, notifyWinCheck: false, notifyWins: false, notifyNewMembers: false, notifyChatDigest: false });
  });
});
