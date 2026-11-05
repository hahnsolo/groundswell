// The petition to deliver (#74): a campaign's ask and its signatures, as a
// spreadsheet (CSV) and a PDF. Only names, the rough area (like M5V or a ZIP
// code), the date and the signer's note: never emails or addresses. People
// who deleted their account are left out (their signatures go when they do).
// Pure, so it's easy to test.

export type Signer = {
  name: string;
  deactivatedAt: Date | null;
  homeCountry: string | null;
  homePostal: string | null;
};

export type PetitionRow = { name: string; area: string; signedOn: string; note: string };

/** The rough area a signer gave as home, e.g. "M5V, Canada" or "90046, USA". Blank if they didn't. */
export function areaOf(country: string | null, postal: string | null) {
  if (!postal) return "";
  const where = country === "CA" ? "Canada" : country === "US" ? "USA" : (country ?? "");
  return [postal.toUpperCase(), where].filter(Boolean).join(", ");
}

/** "2026-11-05", the same however the reader's computer shows dates. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** One row per signature, oldest first, without deleted accounts. */
export function petitionRows(signatures: { createdAt: Date; note: string | null; user: Signer }[]): PetitionRow[] {
  return signatures
    .filter((s) => !s.user.deactivatedAt)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => ({
      name: s.user.name.trim(),
      area: areaOf(s.user.homeCountry, s.user.homePostal),
      signedOn: isoDay(s.createdAt),
      note: (s.note ?? "").replace(/\s+/g, " ").trim(),
    }));
}

export const PETITION_COLUMNS = ["Name", "Area", "Signed on", "Note"] as const;

/**
 * A CSV cell, quoted when needed. Cells starting with = + - @ get a leading
 * apostrophe so a spreadsheet never runs them as formulas.
 */
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The spreadsheet: a header row, then one row per signature. With a BOM so Excel reads accents right. */
export function petitionCsv(rows: PetitionRow[]) {
  const lines = [PETITION_COLUMNS.join(","), ...rows.map((r) => [r.name, r.area, r.signedOn, r.note].map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A file name from the ask: "petition-fix-the-crossing-2026-11-05.pdf". */
export function petitionFileName(ask: string, ext: "pdf" | "csv", on = new Date()) {
  const slug = ask
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return `petition-${slug || "signatures"}-${isoDay(on)}.${ext}`;
}

/** How it was delivered, in words for the timeline. */
export const DELIVERED_HOW: Record<string, string> = { email: "by email", letter: "by letter", meeting: "at a meeting", in_person: "in person" };
