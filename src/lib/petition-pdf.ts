import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PetitionRow } from "./petition";

// The petition as a clean PDF to hand over or attach (#74): the ask, who it's
// to, the cause, the count, then every signature, with page numbers. Drawn
// with the standard Helvetica font (no font files to ship). It covers English
// and French letters; anything it can't draw becomes "?".

type Petition = {
  ask: string;
  target: string;
  causeTitle: string;
  place: string;
  url: string;
  generatedOn: string;
  rows: PetitionRow[];
};

const PAGE = { w: 612, h: 792 }; // US Letter, in points
const M = 54; // margins
const INK = rgb(0.12, 0.16, 0.27);
const MUTED = rgb(0.38, 0.4, 0.46);
const RULE = rgb(0.85, 0.85, 0.85);

/** Keep only what the font can draw; swap the rest for "?". */
function drawable(font: PDFFont, text: string) {
  let out = "";
  for (const ch of text.normalize("NFC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Splits text into lines that fit the width. */
function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of drawable(font, text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    // A word too long for a line on its own is cut.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > width) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function petitionPdf(p: Petition) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Petition: ${p.ask}`.slice(0, 200));
  doc.setProducer("Groundswell");
  doc.setCreator("Groundswell");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE.w - 2 * M;

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;
  const text = (s: string, x: number, size: number, f = font, color = INK) => page.drawText(drawable(f, s), { x, y, size, font: f, color });
  const block = (s: string, size: number, f = font, color = INK, gap = 4) => {
    for (const line of wrap(f, s, size, width)) {
      text(line, M, size, f, color);
      y -= size + gap;
    }
  };

  // The cover: what's asked, of whom, by whom.
  text("PETITION", M, 10, bold, MUTED);
  y -= 26;
  block(p.ask, 20, bold, INK, 6);
  y -= 8;
  block(`To: ${p.target}`, 12, bold);
  block(`From neighbours of "${p.causeTitle}", ${p.place}`, 11);
  y -= 4;
  block(`${p.rows.length} ${p.rows.length === 1 ? "signature" : "signatures"} as of ${p.generatedOn}. Each person signed on Groundswell with their own account.`, 10, font, MUTED);
  block(p.url, 10, font, MUTED);
  y -= 14;

  // The signatures, as a table.
  const cols = [
    { label: "#", x: M, w: 24 },
    { label: "Name", x: M + 24, w: 150 },
    { label: "Area", x: M + 178, w: 92 },
    { label: "Signed", x: M + 274, w: 62 },
    { label: "Note", x: M + 340, w: width - 340 },
  ];
  const header = () => {
    for (const c of cols) text(c.label, c.x, 9, bold, MUTED);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: M + width, y }, thickness: 0.8, color: RULE });
    y -= 12;
  };
  header();
  const size = 9;
  const lead = 11.5;
  p.rows.forEach((r, i) => {
    const cells = [String(i + 1), r.name, r.area || "—", r.signedOn, r.note].map((v, c) => wrap(c === 1 ? bold : font, v, size, cols[c].w - 6));
    const lines = Math.max(...cells.map((c) => c.length));
    if (y - lines * lead < M + 24) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - M;
      header();
    }
    cells.forEach((cell, c) => cell.forEach((line, l) => page.drawText(line, { x: cols[c].x, y: y - l * lead, size, font: c === 1 ? bold : font, color: c === 0 ? MUTED : INK })));
    y -= lines * lead + 4;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: M + width, y: y + 8 }, thickness: 0.4, color: RULE });
    y -= 4;
  });
  if (p.rows.length === 0) block("No signatures yet.", 10, font, MUTED);

  // Page numbers.
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    pg.drawText(label, { x: PAGE.w - M - font.widthOfTextAtSize(label, 8), y: M / 2, size: 8, font, color: MUTED });
    const footer = `Petition: ${p.ask}`;
    const short = footer.length > 85 ? `${footer.slice(0, 84).replace(/\s+\S*$/, "")}…` : footer;
    pg.drawText(drawable(font, short), { x: M, y: M / 2, size: 8, font, color: MUTED });
  });
  return doc.save();
}
