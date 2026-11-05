import { describe, expect, it } from "vitest";
import { canInviteCoLeader, coLeadInviteOpen, coLeadPlacesTaken, leadsCause, MAX_CO_LEADERS } from "@/lib/leadership";
import { canEditCause } from "@/lib/editing";
import { countActive } from "@/lib/leading-limit";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const accepted = (userId: string) => ({ userId, acceptedAt: daysAgo(1), createdAt: daysAgo(2) });
const invited = (userId: string, days = 1) => ({ userId, acceptedAt: null, createdAt: daysAgo(days) });

describe("co-leaders", () => {
  const cause = { leaderId: "dev", removedAt: null, coLeaders: [accepted("maya"), invited("sam")] };

  it("lead alongside the leader once they accept", () => {
    expect(leadsCause(cause, "dev")).toBe(true);
    expect(leadsCause(cause, "maya")).toBe(true);
    expect(leadsCause(cause, "sam")).toBe(false); // only invited
    expect(leadsCause(cause, "priya")).toBe(false);
    expect(leadsCause(cause, null)).toBe(false);
  });

  it("can edit the cause like the leader", () => {
    expect(canEditCause(cause, "maya")).toBe(true);
    expect(canEditCause(cause, "sam")).toBe(false);
    expect(canEditCause({ ...cause, removedAt: new Date() }, "maya")).toBe(false);
  });

  it("are invited only by the leader, from members, up to 2 including open invites", () => {
    const member = (userId: string) => ({ userId, isMember: true });
    expect(MAX_CO_LEADERS).toBe(2);
    expect(canInviteCoLeader({ ...cause, coLeaders: [] }, "dev", member("priya"))).toBeNull();
    expect(canInviteCoLeader({ ...cause, coLeaders: [] }, "maya", member("priya"))).toMatch(/Only the person leading/);
    expect(canInviteCoLeader({ ...cause, coLeaders: [] }, "dev", { userId: "priya", isMember: false })).toMatch(/joined/);
    expect(canInviteCoLeader(cause, "dev", member("priya"))).toMatch(/up to 2/);
    expect(canInviteCoLeader({ ...cause, coLeaders: [accepted("maya")] }, "dev", member("maya"))).toMatch(/already co-lead/);
    expect(canInviteCoLeader({ ...cause, coLeaders: [invited("sam")] }, "dev", member("sam"))).toMatch(/already been invited/);
  });

  it("invites lapse after 7 days and free their place", () => {
    expect(coLeadInviteOpen(invited("sam", 6))).toBe(true);
    expect(coLeadInviteOpen(invited("sam", 8))).toBe(false);
    const stale = { ...cause, coLeaders: [accepted("maya"), invited("sam", 8)] };
    expect(coLeadPlacesTaken(stale)).toBe(1);
    expect(canInviteCoLeader(stale, "dev", { userId: "priya", isMember: true })).toBeNull();
    expect(canInviteCoLeader(stale, "dev", { userId: "sam", isMember: true })).toBeNull(); // re-invite
  });

  it("count toward the same 3-active-causes limit (the count is over led and co-led causes alike)", () => {
    // getActiveLedCauses fetches causes someone leads OR co-leads; the count rule is the same.
    expect(countActive([{ stage: "raised" }, { stage: "organizing" }, { stage: "won" }])).toBe(2);
  });
});
