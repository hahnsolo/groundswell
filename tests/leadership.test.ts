import { describe, expect, it } from "vitest";
import { canOfferLead, LEAD_OFFER_DAYS, leadershipLine, offerOpen } from "@/lib/leadership";

const NOW = new Date("2026-11-20T18:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);

describe("handing over a cause", () => {
  const cause = { leaderId: "dev", removedAt: null };

  it("is for the person leading it, to someone who joined", () => {
    expect(canOfferLead(cause, "dev", { userId: "maya", isMember: true })).toBeNull();
    expect(canOfferLead(cause, "sam", { userId: "maya", isMember: true })).toMatch(/Only the person leading/);
    expect(canOfferLead(cause, "dev", { userId: "maya", isMember: false })).toMatch(/joined/);
    expect(canOfferLead(cause, "dev", { userId: "dev", isMember: true })).toMatch(/already lead/);
  });

  it("isn't possible once a moderator removed the cause", () => {
    expect(canOfferLead({ ...cause, removedAt: daysAgo(1) }, "dev", { userId: "maya", isMember: true })).toMatch(/Only/);
  });

  it(`keeps an offer open for ${LEAD_OFFER_DAYS} days, until it's answered`, () => {
    expect(offerOpen({ createdAt: daysAgo(6.9), answeredAt: null }, NOW)).toBe(true);
    expect(offerOpen({ createdAt: daysAgo(7), answeredAt: null }, NOW)).toBe(false);
    expect(offerOpen({ createdAt: daysAgo(1), answeredAt: daysAgo(0.5) }, NOW)).toBe(false);
    expect(offerOpen(null, NOW)).toBe(false);
  });

  it("shows both people when the leader isn't the starter", () => {
    expect(leadershipLine("Dev", "Dev", true)).toBe("started by Dev");
    expect(leadershipLine("Dev", "Maya", false)).toBe("started by Dev · led by Maya");
  });

  it("names co-leaders alongside the leader", () => {
    expect(leadershipLine("Dev", "Dev", true, ["Maya"])).toBe("started by Dev · led by Dev and Maya");
    expect(leadershipLine("Dev", "Maya", false, ["Sam", "Priya"])).toBe("started by Dev · led by Maya, Sam and Priya");
  });
});
