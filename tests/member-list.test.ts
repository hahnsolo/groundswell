import { describe, expect, it } from "vitest";
import { A_NEIGHBOUR, fromLabel, listMembers, shownName, type MemberRow } from "@/lib/member-list";

describe("who sees which names (#79)", () => {
  const open = { id: "a", name: "Alex", showName: true };
  const hidden = { id: "s", name: "Sam", showName: false };

  it("shows names of people who allow it, to everyone", () => {
    expect(shownName(open)).toBe("Alex");
    expect(shownName(open, { viewerId: null })).toBe("Alex");
  });

  it("hides the name from the public and other members when the setting is off", () => {
    expect(shownName(hidden)).toBe(A_NEIGHBOUR);
    expect(shownName(hidden, { viewerId: "a" })).toBe(A_NEIGHBOUR);
  });

  it("still shows it to the people leading the cause, and to themselves", () => {
    expect(shownName(hidden, { viewerId: "p", seesAll: true })).toBe("Sam");
    expect(shownName(hidden, { viewerId: "s" })).toBe("Sam");
  });

  it("keeps the name for public roles: leading, co-leading, starting a cause, hosting", () => {
    expect(shownName(hidden, { viewerId: "a", publicRole: true })).toBe("Sam");
  });

  it("says Former member for deleted accounts, whoever's looking", () => {
    expect(shownName({ ...open, deactivatedAt: new Date() }, { seesAll: true })).toBe("Former member");
  });
});

describe("the Members list (#79)", () => {
  const row = (id: string, joinedAt: string, signed: boolean, going: boolean): MemberRow => ({ id, name: id, joinedAt, signed, going, from: null, role: null, hidden: false });
  const rows = [row("old", "2026-10-01T00:00:00.000Z", true, false), row("new", "2026-11-01T00:00:00.000Z", false, true), row("mid", "2026-10-15T00:00:00.000Z", false, false)];
  const ids = (r: MemberRow[]) => r.map((m) => m.id);

  it("sorts by newest or oldest", () => {
    expect(ids(listMembers(rows, "all", "newest"))).toEqual(["new", "mid", "old"]);
    expect(ids(listMembers(rows, "all", "oldest"))).toEqual(["old", "mid", "new"]);
  });

  it("filters to who hasn't signed, or isn't going", () => {
    expect(ids(listMembers(rows, "not_signed", "newest"))).toEqual(["new", "mid"]);
    expect(ids(listMembers(rows, "not_going", "newest"))).toEqual(["mid", "old"]);
  });

  it("says where people came from", () => {
    expect(fromLabel("invite", "me", "me")).toBe("from your invite");
    expect(fromLabel("invite", "other", "me")).toBe("from a co-leader's invite");
    expect(fromLabel("flyer", null, "me")).toBe("from the flyer");
    expect(fromLabel("whatsapp", null, "me")).toBe("from WhatsApp");
    expect(fromLabel(null, null, "me")).toBeNull();
    expect(fromLabel("nonsense", null, "me")).toBeNull();
  });
});
