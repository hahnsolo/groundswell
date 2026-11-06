import { describe, expect, it } from "vitest";
import { CHAT_PAGE, dayLabel, MAX_CHAT_SHOWN, messagesToShow, startsGroup } from "@/lib/chat-days";

describe("how many messages a chat loads (#97)", () => {
  it("opens with one page", () => {
    expect(messagesToShow(undefined)).toBe(CHAT_PAGE);
    expect(messagesToShow("")).toBe(CHAT_PAGE);
  });
  it("adds whole pages", () => {
    expect(messagesToShow("100")).toBe(100);
    expect(messagesToShow("101")).toBe(150);
  });
  it("ignores nonsense and stops at the limit", () => {
    expect(messagesToShow("abc")).toBe(CHAT_PAGE);
    expect(messagesToShow("-5")).toBe(CHAT_PAGE);
    expect(messagesToShow(["100", "200"])).toBe(CHAT_PAGE);
    expect(messagesToShow("Infinity")).toBe(CHAT_PAGE);
    expect(messagesToShow("99999999")).toBe(MAX_CHAT_SHOWN);
  });
});

describe("chat grouping (#70)", () => {
  const at = (s: string) => new Date(s);

  it("groups messages from the same person close together", () => {
    const prev = { authorId: "sam", createdAt: at("2026-11-05T10:00:00"), removed: false };
    expect(startsGroup(null, { authorId: "sam", createdAt: at("2026-11-05T10:01:00") })).toBe(true);
    expect(startsGroup(prev, { authorId: "sam", createdAt: at("2026-11-05T10:05:00") })).toBe(false);
    expect(startsGroup(prev, { authorId: "alex", createdAt: at("2026-11-05T10:05:00") })).toBe(true);
    expect(startsGroup(prev, { authorId: "sam", createdAt: at("2026-11-05T10:11:00") })).toBe(true);
    expect(startsGroup({ ...prev, removed: true }, { authorId: "sam", createdAt: at("2026-11-05T10:01:00") })).toBe(true);
  });

  it("separates days as Today, Yesterday, the weekday, then the date", () => {
    const now = at("2026-11-05T15:00:00"); // a Thursday
    expect(dayLabel(at("2026-11-05T09:00:00"), null, now, "en-US")).toBe("Today");
    expect(dayLabel(at("2026-11-05T09:00:00"), at("2026-11-05T08:00:00"), now, "en-US")).toBeNull();
    expect(dayLabel(at("2026-11-04T23:30:00"), at("2026-11-03T08:00:00"), now, "en-US")).toBe("Yesterday");
    expect(dayLabel(at("2026-11-02T12:00:00"), null, now, "en-US")).toBe("Monday");
    expect(dayLabel(at("2026-10-20T12:00:00"), null, now, "en-US")).toBe("Tue, Oct 20");
    expect(dayLabel(at("2025-12-31T12:00:00"), null, now, "en-US")).toBe("Wed, Dec 31, 2025");
  });
});
