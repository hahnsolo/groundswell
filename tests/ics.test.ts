import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, icsDate } from "@/lib/ics";

const event = {
  id: "m1",
  title: "Tenants' rights info night",
  startsAt: new Date("2026-10-29T23:00:00Z"),
  location: "Fort York library, meeting room 2",
  description: "Bring your notice; the clinic wants to see them.",
  url: "https://groundswell.hahnsolo.ca/events/m1",
  now: new Date("2026-10-20T12:00:00Z"),
};

describe("Add to calendar (.ics)", () => {
  it("formats times in UTC the way calendars expect", () => {
    expect(icsDate(new Date("2026-10-29T23:00:00.000Z"))).toBe("20261029T230000Z");
  });

  it("escapes characters that have meaning in the format", () => {
    expect(escapeIcsText("a, b; c\\d\nline two")).toBe("a\\, b\\; c\\\\d\\nline two");
  });

  it("builds a single event lasting two hours", () => {
    const ics = buildIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261029T230000Z");
    expect(ics).toContain("DTEND:20261030T010000Z");
    expect(ics).toContain("UID:m1@groundswell");
    expect(ics).toContain("LOCATION:Fort York library\\, meeting room 2");
    expect(ics).toContain("SUMMARY:Tenants' rights info night");
  });

  it("keeps every line within the 75-byte limit", () => {
    const ics = buildIcs({ ...event, description: "x".repeat(400) });
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
