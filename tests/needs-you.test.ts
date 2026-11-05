import { describe, expect, it } from "vitest";
import { needsYou, type NeedsInput } from "@/lib/needs-you";

const NOW = new Date("2026-11-20T18:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000);
const ahead = (days: number) => new Date(NOW + days * 24 * 60 * 60 * 1000);
const empty: NeedsInput = { leadOffers: [], coLeadInvites: [], wins: [], led: [], hosting: [], reports: [] };
const kinds = (input: Partial<NeedsInput>) => needsYou({ ...empty, ...input }, NOW).map((n) => n.kind);

describe("what needs a leader (#75)", () => {
  it("is empty and quiet when there's nothing to do", () => {
    expect(needsYou(empty, NOW)).toEqual([]);
    expect(kinds({ led: [{ id: "c", title: "Crossing", stage: "gathering", quietAskedAt: null, newMembers: 0 }] })).toEqual([]);
  });

  it("asks them to answer open lead and co-lead offers, not lapsed or answered ones", () => {
    const needs = needsYou(
      {
        ...empty,
        leadOffers: [
          { causeId: "a", causeTitle: "Park", fromName: "Sam", createdAt: ago(1), answeredAt: null },
          { causeId: "b", causeTitle: "Old", fromName: "Sam", createdAt: ago(8), answeredAt: null },
          { causeId: "c", causeTitle: "Done", fromName: "Sam", createdAt: ago(1), answeredAt: ago(0.5) },
        ],
        coLeadInvites: [{ causeId: "d", causeTitle: "Rent", inviterName: "Priya", createdAt: ago(2), acceptedAt: null }],
      },
      NOW,
    );
    expect(needs.map((n) => [n.kind, n.href])).toEqual([
      ["lead_offer", "/causes/a"],
      ["co_lead", "/causes/d"],
    ]);
    expect(needs[1].text).toBe('Priya asked you to co-lead "Rent". Accept or decline.');
  });

  it("shows their own win waiting, and others' wins to confirm, once", () => {
    const base = { causeTitle: "Crossing", proposerName: "Sam", confirmed: 1, members: 8, createdAt: ago(2), resolvedAt: null };
    const needs = needsYou(
      {
        ...empty,
        wins: [
          { ...base, causeId: "mine", proposedByMe: true, confirmedByMe: false },
          { ...base, causeId: "theirs", proposedByMe: false, confirmedByMe: false },
          { ...base, causeId: "confirmed", proposedByMe: false, confirmedByMe: true },
          { ...base, causeId: "lapsed", proposedByMe: false, confirmedByMe: false, createdAt: ago(8) },
        ],
      },
      NOW,
    );
    expect(needs.map((n) => n.kind)).toEqual(["your_win", "confirm_win"]);
    expect(needs[0].text).toBe('Your win on "Crossing" is waiting: 1 of 2 confirmations.');
    expect(needs[1].href).toBe("/causes/theirs#win");
  });

  it("covers quiet causes, reports, hosting this week and new members, in that order", () => {
    const needs = needsYou(
      {
        ...empty,
        led: [
          { id: "q", title: "Quiet one", stage: "organizing", quietAskedAt: ago(3), newMembers: 0 },
          { id: "n", title: "Busy one", stage: "gathering", quietAskedAt: null, newMembers: 3 },
          { id: "w", title: "Won one", stage: "won", quietAskedAt: ago(3), newMembers: 5 },
        ],
        reports: [{ causeId: "n", causeTitle: "Busy one", count: 2 }],
        hosting: [
          { id: "e2", title: "Later", startsAt: ahead(5) },
          { id: "e1", title: "Soon", startsAt: ahead(1) },
          { id: "e3", title: "Next month", startsAt: ahead(30) },
          { id: "e0", title: "Last week", startsAt: ago(2) },
        ],
      },
      NOW,
    );
    expect(needs.map((n) => n.key)).toEqual(["sg-q", "rp-n", "ho-e1", "ho-e2", "nm-n"]);
    expect(needs.at(-1)?.text).toBe('3 new members in "Busy one" since you last looked.');
    expect(needs[1].text).toBe('2 reports on "Busy one" waiting for a moderator.');
  });
});
