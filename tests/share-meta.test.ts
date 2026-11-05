import { describe, expect, it } from "vitest";
import { causeShare, clip, eventShare } from "@/lib/share-meta";
import { placeTime, zoneFor } from "@/lib/time-zones";

const cause = {
  title: "No safe crossing on Santa Monica Blvd near the elementary school",
  description: "Kids heading to school have to cross four lanes with no signal.",
  ask: null,
  placeName: "Beverly Hills",
  region: "CA",
  stage: "organizing",
  members: 23,
  hidden: false,
  removedAt: null,
};

describe("clip", () => {
  it("leaves short text alone and flattens whitespace", () => expect(clip("Hello\n  there", 50)).toBe("Hello there"));
  it("cuts long text on a word, with an ellipsis", () => {
    const out = clip("The bench outside the Spadina Road library has been broken since September", 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe("cause previews", () => {
  it("show the title, place, members and the description", () => {
    const s = causeShare(cause)!;
    expect(s.title).toBe(cause.title);
    expect(s.description).toMatch(/^Beverly Hills, CA · 23 neighbours have joined\. Kids heading/);
    expect(s.stage).toBe("Organizing");
  });

  it("lead with the ask when there's a campaign", () => {
    expect(causeShare({ ...cause, ask: "Install a signalized crossing" })!.description).toMatch(/The ask: Install a signalized crossing/);
  });

  it("say 1 neighbour, not 1 neighbours", () => expect(causeShare({ ...cause, members: 1 })!.joined).toBe("1 neighbour has joined"));

  it("give nothing away for hidden or removed causes", () => {
    expect(causeShare({ ...cause, hidden: true })).toBeNull();
    expect(causeShare({ ...cause, removedAt: new Date() })).toBeNull();
  });
});

describe("event previews", () => {
  const event = {
    title: "Morning crossing count",
    startsAt: new Date("2026-11-10T15:30:00Z"),
    location: "Corner of Santa Monica Blvd & Rexford Dr",
    isOnline: false,
    going: 2,
    cause: { ...cause, country: "US" },
  };

  it("show the date in the place's own time zone, the place and the cause", () => {
    const s = eventShare(event)!;
    expect(s.when).toMatch(/Tue, Nov 10.*7:30.*PST/);
    expect(s.description).toMatch(/Corner of Santa Monica.*Part of “No safe crossing/);
  });

  it("never show an online event's link", () => {
    const s = eventShare({ ...event, isOnline: true, location: "https://meet.example/secret-room" })!;
    expect(s.where).toBe("Online");
    expect(s.description).not.toMatch(/secret-room/);
  });

  it("give nothing away when the cause is hidden or removed", () => expect(eventShare({ ...event, cause: { ...event.cause, hidden: true } })).toBeNull());
});

describe("time zones", () => {
  it("use the province's or state's usual zone", () => {
    expect(zoneFor("CA", "ON")).toBe("America/Toronto");
    expect(zoneFor("CA", "bc")).toBe("America/Vancouver");
    expect(zoneFor("US", "AZ")).toBe("America/Phoenix");
    expect(zoneFor("US", "ZZ")).toBe("America/New_York");
  });
  it("format in that zone", () => expect(placeTime(new Date("2026-11-10T23:00:00Z"), "CA", "ON")).toMatch(/Nov 10.*6:00.*EST/));
});
