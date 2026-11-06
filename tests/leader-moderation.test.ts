import { describe, expect, it } from "vitest";
import { canHideMessage, removeProblem } from "@/lib/leader-moderation";

const leader = { id: "lead", leads: true };
const member = { id: "m", leads: false };

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
