import { describe, expect, it } from "vitest";
import { parsePostal } from "@/lib/countries";

function postal(country: string, raw: string) {
  const r = parsePostal(country, raw);
  return r.ok ? r.postal : null;
}

describe("Canadian postal codes", () => {
  it("keeps only the first three characters (the FSA), never the full code", () => {
    expect(postal("CA", "M5V 2T6")).toBe("M5V");
    expect(postal("CA", "m5v2t6")).toBe("M5V");
    expect(postal("CA", "M5V")).toBe("M5V");
  });

  it("rejects codes that can't exist", () => {
    expect(postal("CA", "D5V 2T6")).toBeNull(); // D is never used
    expect(postal("CA", "12345")).toBeNull();
  });
});

describe("US ZIP codes", () => {
  it("accepts 5-digit and ZIP+4, storing 5 digits", () => {
    expect(postal("US", "90210")).toBe("90210");
    expect(postal("US", "90210-1234")).toBe("90210");
  });

  it("rejects malformed ZIPs", () => {
    expect(postal("US", "9021")).toBeNull();
    expect(postal("US", "M5V")).toBeNull();
  });
});

describe("countries", () => {
  it("refuses unsupported countries", () => {
    expect(parsePostal("FR", "75001")).toEqual({ ok: false, error: "We don't support that country yet." });
  });

  it("accepts lowercase country codes", () => {
    expect(postal("ca", "M5V")).toBe("M5V");
  });
});
