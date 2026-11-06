import { describe, expect, it } from "vitest";
import { acceptsPeople, canHideMessage, removeProblem, staysHiddenAfterUnhide } from "@/lib/leader-moderation";

const leader = { id: "lead", leads: true };
const member = { id: "m", leads: false };

describe("which causes take new people (#97)", () => {
  const open = { stage: "gathering", hidden: false, removedAt: null };
  it("takes them on an open cause", () => expect(acceptsPeople(open)).toBe(true));
  it("not on a closed, hidden or removed one, or one that's gone", () => {
    expect(acceptsPeople({ ...open, stage: "closed" })).toBe(false);
    expect(acceptsPeople({ ...open, hidden: true })).toBe(false);
    expect(acceptsPeople({ ...open, removedAt: new Date() })).toBe(false);
    expect(acceptsPeople(null)).toBe(false);
  });
});

describe("a leader's Unhide (#97)", () => {
  it("shows the message when few others reported it", () => expect(staysHiddenAfterUnhide(2)).toBe(false));
  it("leaves it hidden for a moderator when the community's reports would have hidden it", () => expect(staysHiddenAfterUnhide(3)).toBe(true));
});

describe("who can hide what (#71)", () => {
  it("lets the people leading a cause hide others' messages", () => {
    expect(canHideMessage(leader, { id: "m" })).toBe(true);
  });
  it("not moderators' messages, or their own", () => {
    expect(canHideMessage(leader, { id: "admin", isAdmin: true })).toBe(false);
    expect(canHideMessage(leader, { id: "lead" })).toBe(false);
  });
  it("not members or visitors", () => {
    expect(canHideMessage(member, { id: "x" })).toBe(false);
    expect(canHideMessage({ id: null, leads: false }, { id: "x" })).toBe(false);
  });
});

describe("who can remove whom (#71)", () => {
  it("lets the people leading a cause remove a member", () => {
    expect(removeProblem(leader, { id: "m" })).toBeNull();
  });
  it("refuses everyone else", () => {
    expect(removeProblem(member, { id: "x" })).toMatch(/Only the people leading/);
  });
  it("not themselves, the leader, co-leaders or moderators", () => {
    expect(removeProblem(leader, { id: "lead" })).toMatch(/yourself/);
    expect(removeProblem({ id: "co", leads: true }, { id: "lead", isLeader: true })).toMatch(/can't be removed/);
    expect(removeProblem(leader, { id: "c", isCoLeader: true })).toMatch(/under Co-leaders/);
    expect(removeProblem(leader, { id: "a", isAdmin: true })).toMatch(/Moderators/);
  });
});
