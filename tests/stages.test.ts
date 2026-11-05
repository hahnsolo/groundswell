import { describe, expect, it } from "vitest";
import {
  advance,
  canReopen,
  confirmationsNeeded,
  isActive,
  nextStep,
  proposalOpen,
  reachedStage,
  shouldAskIfStillGoing,
  shouldCloseAsQuiet,
} from "@/lib/stages";

const NOW = new Date("2026-11-20T18:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);
const none = { members: 1, heldEvent: false, tookAction: false };

describe("stages follow what happens", () => {
  it("starts at Raised and gathers at 5 members", () => {
    expect(reachedStage(none)).toBe("raised");
    expect(reachedStage({ ...none, members: 4 })).toBe("raised");
    expect(reachedStage({ ...none, members: 5 })).toBe("gathering");
  });

  it("reaches Organizing once an event has happened, and Taking action with a campaign or contact", () => {
    expect(reachedStage({ ...none, heldEvent: true })).toBe("organizing");
    expect(reachedStage({ ...none, tookAction: true })).toBe("taking_action");
  });

  it("can skip stages: a small cause that contacted the city goes straight to Taking action", () => {
    expect(advance("raised", { members: 4, heldEvent: false, tookAction: true })).toBe("taking_action");
  });

  it("never moves backward on its own", () => {
    expect(advance("gathering", { ...none, members: 3 })).toBe("gathering");
    expect(advance("taking_action", none)).toBe("taking_action");
  });

  it("leaves Won and Closed alone", () => {
    expect(advance("won", { members: 9, heldEvent: true, tookAction: true })).toBe("won");
    expect(advance("closed", { members: 9, heldEvent: true, tookAction: true })).toBe("closed");
    expect(isActive("won")).toBe(false);
    expect(isActive("closed")).toBe(false);
    expect(isActive("organizing")).toBe(true);
  });

  it("says what the next step is", () => {
    expect(nextStep("raised", 2)).toBe("3 more neighbours joining moves this to Gathering.");
    expect(nextStep("raised", 4)).toBe("1 more neighbour joining moves this to Gathering.");
    expect(nextStep("won", 9)).toBeNull();
  });
});

describe("member-confirmed wins", () => {
  it("needs 2 other members, or 1 in a small cause", () => {
    expect(confirmationsNeeded(3)).toBe(1);
    expect(confirmationsNeeded(4)).toBe(2);
    expect(confirmationsNeeded(40)).toBe(2);
  });

  it("keeps a proposal open for 7 days", () => {
    expect(proposalOpen({ createdAt: daysAgo(6.9), resolvedAt: null }, NOW)).toBe(true);
    expect(proposalOpen({ createdAt: daysAgo(7), resolvedAt: null }, NOW)).toBe(false);
    expect(proposalOpen({ createdAt: daysAgo(1), resolvedAt: daysAgo(0.5) }, NOW)).toBe(false);
  });
});

describe("closing and going quiet", () => {
  it("can be reopened for 30 days", () => {
    expect(canReopen(daysAgo(29), NOW)).toBe(true);
    expect(canReopen(daysAgo(30), NOW)).toBe(false);
    expect(canReopen(null, NOW)).toBe(false);
  });

  it("asks after 90 quiet days, and closes 14 days later if nothing happened", () => {
    expect(shouldAskIfStillGoing(daysAgo(89), null, NOW)).toBe(false);
    expect(shouldAskIfStillGoing(daysAgo(90), null, NOW)).toBe(true);
    expect(shouldAskIfStillGoing(daysAgo(120), daysAgo(5), NOW)).toBe(false);
    expect(shouldCloseAsQuiet(daysAgo(120), daysAgo(14), NOW)).toBe(true);
    expect(shouldCloseAsQuiet(daysAgo(120), daysAgo(13), NOW)).toBe(false);
    expect(shouldCloseAsQuiet(daysAgo(2), daysAgo(20), NOW)).toBe(false); // something happened after asking
  });
});
