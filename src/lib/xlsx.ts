import { strFromU8, unzipSync } from "fflate";

// Reads the first sheet of an Excel file (.xlsx) into rows of text, in the
// browser (#68). An .xlsx is a zip of XML files; this reads just the cells'
// text and ignores everything else (formulas, styles, other sheets). Written
// here on top of fflate instead of adding a spreadsheet library, to keep our
// dependencies small and well known.

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** All the text runs inside a piece of XML (<t>…</t>), joined. */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

/** "C12" → 2 (the column, from 0). */
function column(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, {
    filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name === "xl/sharedStrings.xml" || f.name.startsWith("xl/worksheets/sheet"),
  });
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : "");

  // The first sheet in the workbook's order (not always sheet1.xml).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const firstId = read("xl/workbook.xml").match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = firstId && read("xl/_rels/workbook.xml.rels").match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1];
  if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  if (!files[sheetPath]) sheetPath = Object.keys(files).filter((n) => n.startsWith("xl/worksheets/sheet")).sort()[0] ?? "";
  const sheet = read(sheetPath);
  if (!sheet) throw new Error("That file doesn't have a sheet we can read.");

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const inner = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d*"/i)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = texts(inner);
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) {
        value = decode(v);
        // Big numbers (phone numbers typed as numbers) can be stored as 4.1655501E+9.
        if (/^-?\d+(\.\d+)?E[+-]?\d+$/i.test(value)) value = String(Number(value));
      }
      const at = ref ? column(ref) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value;
    }
    rows.push(cells);
  }
  return rows;
}
