import { describe, expect, it } from "vitest";
import { canEditCause, canEditEvent, canEditMessage, MESSAGE_EDIT_MINUTES } from "@/lib/editing";

const NOW = new Date("2026-11-20T18:00:00Z").getTime();
const minutesAgo = (n: number) => new Date(NOW - n * 60 * 1000);
const hoursFromNow = (n: number) => new Date(NOW + n * 60 * 60 * 1000);

describe("editing a cause", () => {
  const cause = { authorId: "maya", removedAt: null };
  it("is for the person who started it", () => {
    expect(canEditCause(cause, "maya")).toBe(true);
    expect(canEditCause(cause, "dev")).toBe(false);
    expect(canEditCause(cause, null)).toBe(false);
  });
  it("isn't possible once a moderator removed it", () => {
    expect(canEditCause({ ...cause, removedAt: minutesAgo(5) }, "maya")).toBe(false);
  });
});

describe("editing an event", () => {
  const event = { organizerId: "dev", endsAt: hoursFromNow(3), cause: { removedAt: null } };
  it("is for the host, until the event is over", () => {
    expect(canEditEvent(event, "dev", NOW)).toBe(true);
    expect(canEditEvent(event, "maya", NOW)).toBe(false);
    expect(canEditEvent({ ...event, endsAt: minutesAgo(1) }, "dev", NOW)).toBe(false);
  });
  it("isn't possible if its cause was removed", () => {
    expect(canEditEvent({ ...event, cause: { removedAt: minutesAgo(5) } }, "dev", NOW)).toBe(false);
  });
});

describe("editing a chat message", () => {
  const message = { authorId: "rosa", createdAt: minutesAgo(2), removedAt: null, hidden: false };
  it(`is for its author, for ${MESSAGE_EDIT_MINUTES} minutes`, () => {
    expect(canEditMessage(message, "rosa", NOW)).toBe(true);
    expect(canEditMessage(message, "dev", NOW)).toBe(false);
    expect(canEditMessage({ ...message, createdAt: minutesAgo(14.9) }, "rosa", NOW)).toBe(true);
    expect(canEditMessage({ ...message, createdAt: minutesAgo(15) }, "rosa", NOW)).toBe(false);
  });
  it("isn't possible once removed or hidden after reports", () => {
    expect(canEditMessage({ ...message, removedAt: minutesAgo(1) }, "rosa", NOW)).toBe(false);
    expect(canEditMessage({ ...message, hidden: true }, "rosa", NOW)).toBe(false);
  });
});
