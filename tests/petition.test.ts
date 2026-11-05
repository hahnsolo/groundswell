import { describe, expect, it } from "vitest";
import { areaOf, csvCell, petitionCsv, petitionFileName, petitionRows } from "@/lib/petition";

const signer = (name: string, extra: Partial<{ deactivatedAt: Date | null; homeCountry: string | null; homePostal: string | null }> = {}) => ({
  name,
  deactivatedAt: null,
  homeCountry: "CA",
  homePostal: "m5v",
  ...extra,
});

describe("the petition to deliver (#74)", () => {
  it("lists each signature oldest first, with name, rough area, date and note", () => {
    const rows = petitionRows([
      { createdAt: new Date("2026-11-03T15:00:00Z"), note: "  My rent went up\n12%  ", user: signer("Sam Rivera", { homeCountry: "US", homePostal: "90046" }) },
      { createdAt: new Date("2026-11-01T15:00:00Z"), note: null, user: signer("Priya") },
      { createdAt: new Date("2026-11-02T15:00:00Z"), note: null, user: signer("No Area", { homePostal: null }) },
    ]);
    expect(rows).toEqual([
      { name: "Priya", area: "M5V, Canada", signedOn: "2026-11-01", note: "" },
      { name: "No Area", area: "", signedOn: "2026-11-02", note: "" },
      { name: "Sam Rivera", area: "90046, USA", signedOn: "2026-11-03", note: "My rent went up 12%" },
    ]);
  });

  it("leaves out people who deleted their account", () => {
    const rows = petitionRows([
      { createdAt: new Date(), note: null, user: signer("Gone", { deactivatedAt: new Date() }) },
      { createdAt: new Date(), note: null, user: signer("Here") },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Here"]);
  });

  it("never includes emails or addresses: only these columns", () => {
    const csv = petitionCsv([{ name: "Priya", area: "M5V, Canada", signedOn: "2026-11-01", note: "" }]);
    expect(csv).toBe('﻿Name,Area,Signed on,Note\r\nPriya,"M5V, Canada",2026-11-01,\r\n');
    expect(areaOf("US", "90046")).toBe("90046, USA");
    expect(areaOf("CA", null)).toBe("");
  });

  it("quotes cells safely and never lets a spreadsheet run a note as a formula", () => {
    expect(csvCell('She said "fix it"')).toBe('"She said ""fix it"""');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1 more")).toBe("'+1 more");
    expect(csvCell("plain")).toBe("plain");
  });

  it("names the file after the ask", () => {
    expect(petitionFileName("Install a crossing at Santa Monica & Orange!", "pdf", new Date("2026-11-05T12:00:00Z"))).toBe(
      "petition-install-a-crossing-at-santa-monica-orange-2026-11-05.pdf",
    );
    expect(petitionFileName("Réparez l'éclairage", "csv", new Date("2026-11-05T12:00:00Z"))).toBe("petition-reparez-l-eclairage-2026-11-05.csv");
    expect(petitionFileName("???", "csv", new Date("2026-11-05T12:00:00Z"))).toBe("petition-signatures-2026-11-05.csv");
  });
});
