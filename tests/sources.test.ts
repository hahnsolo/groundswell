import { describe, expect, it } from "vitest";
import { isShortCode, keepFirst, makeShortCode, readSource, shortUrl, sourceSummary, taggedUrl, typedLink } from "@/lib/sources";
import { firstName, flyerWhen } from "@/lib/share-meta";

describe("source tags (#67)", () => {
  it("reads our tags and their short forms, and nothing else", () => {
    expect(readSource("flyer")).toBe("flyer");
    expect(readSource("WhatsApp")).toBe("whatsapp");
    expect(readSource("ig")).toBe("instagram");
    expect(readSource("wa")).toBe("whatsapp");
    expect(readSource("")).toBeNull();
    expect(readSource(null)).toBeNull();
    expect(readSource("tiktok")).toBeNull();
    expect(readSource("<script>")).toBeNull();
  });

  it("keeps the first tag: the flyer, then a WhatsApp link, still counts as the flyer", () => {
    expect(keepFirst("flyer", "whatsapp")).toBe("flyer");
    expect(keepFirst(undefined, "whatsapp")).toBe("whatsapp");
    expect(keepFirst("junk", "instagram")).toBe("instagram");
    expect(keepFirst(null, "junk")).toBeNull();
  });

  it("counts each person once and sums by source, biggest first", () => {
    expect(
      sourceSummary([
        { source: "whatsapp", count: 14 },
        { source: "flyer", count: 9 },
        { source: null, count: 30 },
        { source: "nonsense", count: 3 },
      ]),
    ).toBe("14 people came from WhatsApp, 9 from the flyer");
    expect(sourceSummary([{ source: "flyer", count: 1 }])).toBe("1 person came from the flyer");
    expect(sourceSummary([{ source: null, count: 5 }])).toBeNull();
    expect(sourceSummary([])).toBeNull();
  });

  it("builds tagged and short links that point at the right page", () => {
    expect(taggedUrl("https://g.example/causes/abc", "whatsapp")).toBe("https://g.example/causes/abc?src=whatsapp");
    expect(taggedUrl("https://g.example/causes/abc?x=1", "email")).toBe("https://g.example/causes/abc?x=1&src=email");
    expect(shortUrl("https://g.example/", "k7m2qp")).toBe("https://g.example/go/k7m2qp");
    expect(shortUrl("https://g.example", "k7m2qp", "instagram")).toBe("https://g.example/go/k7m2qp/ig");
    expect(typedLink("https://g.example/go/k7m2qp")).toBe("g.example/go/k7m2qp");
  });

  it("makes short codes people can type from paper", () => {
    for (let i = 0; i < 200; i++) {
      const code = makeShortCode();
      expect(isShortCode(code)).toBe(true);
      expect(code).not.toMatch(/[01oil]/);
    }
    expect(isShortCode("abc")).toBe(false);
    expect(isShortCode("ABCDEF")).toBe(false);
    expect(isShortCode("abc10x")).toBe(false);
  });
});

describe("flyer wording (#67)", () => {
  it("shows the day and time in the place's own time zone", () => {
    const start = new Date("2026-11-10T23:00:00Z"); // 6 p.m. in Toronto
    const end = new Date("2026-11-11T01:00:00Z");
    const w = flyerWhen(start, end, "CA", "ON");
    expect(w.day).toMatch(/Tuesday, November 10/);
    expect(w.time).toMatch(/^6:00.*–.*8:00.*E[SD]T$/);
  });

  it("says when a long event ends on another day", () => {
    const w = flyerWhen(new Date("2026-11-10T23:00:00Z"), new Date("2026-11-12T01:00:00Z"), "US", "NY");
    expect(w.time).toMatch(/until Wed, Nov 11/);
  });

  it("uses the host's first name only", () => {
    expect(firstName("Sam Rivera")).toBe("Sam");
    expect(firstName("  Priya  ")).toBe("Priya");
  });
});
