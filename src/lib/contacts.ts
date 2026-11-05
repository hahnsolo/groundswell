// Bring your group over (#68): reading an organizer's own contact list (a
// spreadsheet they export from their phone, Google or their email) and making
// ready-written messages they send themselves. This runs in the browser only:
// the file is never uploaded, and Groundswell never emails or texts anyone on
// it (consent and anti-spam law: CASL in Canada, the TCPA in the US).
// Pure, so it's easy to test.

export type Contact = { name: string; email: string | null; phone: string | null };

/** Rows from CSV text. Handles quotes, commas inside quotes, CRLF, a BOM, and ; or tab separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

/**
 * A phone number as international digits for WhatsApp and texting (no +):
 * "(416) 555-0134" → "14165550134". Ten-digit numbers are taken as North
 * American. Null if it doesn't look like a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!/\d/.test(s) || /[a-z]{3,}/i.test(s.replace(/\b(ext|x)\.?\s*\d+$/i, ""))) return null;
  const main = s.replace(/\s*(ext|x)\.?\s*\d+$/i, ""); // drop extensions
  const plus = main.startsWith("+") || main.startsWith("00");
  let digits = main.replace(/\D/g, "");
  if (main.startsWith("00")) digits = digits.slice(2);
  if (!plus && digits.length === 10) return `1${digits}`;
  if (!plus && digits.length === 11 && digits.startsWith("1")) return digits;
  if (digits.length >= 8 && digits.length <= 15 && plus) return digits;
  return null;
}

/** "14165550134" → "+1 416-555-0134" for showing; other countries just get the +. */
export function showPhone(digits: string) {
  const m = digits.match(/^1(\d{3})(\d{3})(\d{4})$/);
  return m ? `+1 ${m[1]}-${m[2]}-${m[3]}` : `+${digits}`;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const isEmailHeader = (h: string) => /email|mail/.test(norm(h));
const isPhoneHeader = (h: string) => /phone|mobile|cell|tel|whatsapp|sms|number/.test(norm(h));
const FIRST = ["firstname", "first", "givenname", "given", "prenom"];
const LAST = ["lastname", "last", "surname", "familyname", "family", "nom"];
const NAME = ["name", "fullname", "displayname", "contact", "contactname", "nickname"];

/**
 * Contacts from spreadsheet rows. The first row with known column names
 * (Name, First name, Email, Phone, Mobile…) is the header; without one, each
 * cell is recognized by what it looks like. Blank rows, rows with neither an
 * email nor a phone number, and repeats are left out.
 */
export function contactsFromRows(rows: string[][]): { contacts: Contact[]; skipped: number } {
  const clean = rows.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  const headerAt = clean.findIndex((r) => r.some((c) => isEmailHeader(c) || isPhoneHeader(c) || [...NAME, ...FIRST].includes(norm(c))));
  const header = headerAt >= 0 && !clean[headerAt].some((c) => EMAIL.test(c)) ? clean[headerAt] : null;
  const body = header ? clean.slice(headerAt + 1) : clean;

  const cols = header
    ? {
        email: header.map((h, i) => (isEmailHeader(h) ? i : -1)).filter((i) => i >= 0),
        phone: header.map((h, i) => (isPhoneHeader(h) && !isEmailHeader(h) ? i : -1)).filter((i) => i >= 0),
        name: header.findIndex((h) => NAME.includes(norm(h))),
        first: header.findIndex((h) => FIRST.includes(norm(h))),
        last: header.findIndex((h) => LAST.includes(norm(h))),
      }
    : null;

  const contacts: Contact[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const r of body) {
    let email: string | null = null;
    let phone: string | null = null;
    let name = "";
    if (cols) {
      email = cols.email.map((i) => r[i]?.replace(/^mailto:/i, "")).find((v) => v && EMAIL.test(v)) ?? null;
      phone = cols.phone.map((i) => normalizePhone(r[i])).find(Boolean) ?? null;
      const full = cols.name >= 0 ? r[cols.name] : "";
      const parts = [cols.first >= 0 ? r[cols.first] : "", cols.last >= 0 ? r[cols.last] : ""].filter(Boolean).join(" ");
      name = full || parts;
    } else {
      for (const c of r) {
        if (!email && EMAIL.test(c)) email = c;
        else if (!phone && normalizePhone(c) && /^[\d\s()+.\-]+$/.test(c)) phone = normalizePhone(c);
        else if (!name && /[a-z]/i.test(c) && !c.includes("@")) name = c;
      }
    }
    if (!email && !phone) {
      skipped++;
      continue;
    }
    const key = `${email?.toLowerCase() ?? ""}|${phone ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({ name: name.slice(0, 80), email: email?.toLowerCase() ?? null, phone });
  }
  return { contacts, skipped };
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** The ready-written invite. People can change it before sending. */
export function inviteMessage(title: string, place: string, link: string) {
  return `Hi! We're organizing "${title}" in ${place} on Groundswell, so everything's in one place: the chat, the events and the ask. Join us here: ${link}`;
}

/** The same message with their first name, when it starts with "Hi!". */
export function personalize(message: string, name: string) {
  const first = firstNameOf(name);
  return first && /^Hi!/.test(message) ? message.replace(/^Hi!/, `Hi ${first}!`) : message;
}

/** Opens WhatsApp with the message: to one person, or to pick a chat or group (no number). */
export const whatsappLink = (text: string, phone?: string | null) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;

/** Opens the phone's messages app with the message (the "?&body=" form works on iPhone and Android). */
export const textLink = (text: string, phone?: string | null) => `sms:${phone ? `+${phone}` : ""}?&body=${encodeURIComponent(text)}`;

/** Opens their own email app. Addresses go in BCC, so nobody sees the others'. */
export function emailLink({ subject, body, bcc = [] }: { subject: string; body: string; bcc?: string[] }) {
  const parts = [bcc.length ? `bcc=${bcc.map(encodeURIComponent).join(",")}` : "", `subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  return `mailto:?${parts.filter(Boolean).join("&")}`;
}

/** Email apps choke on very long links, so big lists open in groups. */
export const EMAIL_BATCH = 40;
export function batches<T>(items: T[], size = EMAIL_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
