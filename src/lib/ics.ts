// "Add to calendar": a single-event iCalendar (.ics) file, which Google
// Calendar, Apple Calendar and Outlook all open. Pure, so it's easy to test.

/** Events don't have an end time yet, so calendars get this default length. */
export const DEFAULT_EVENT_HOURS = 2;

/** iCalendar text values escape backslashes, commas, semicolons and newlines. */
export function escapeIcsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 2026-10-28T23:00:00.000Z → 20261028T230000Z */
export function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines longer than 75 bytes must be folded: CRLF plus a space. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  description: string;
  url: string;
  now?: Date;
}) {
  const end = new Date(e.startsAt.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Groundswell//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@groundswell`,
    `DTSTAMP:${icsDate(e.now ?? new Date())}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `LOCATION:${escapeIcsText(e.location)}`,
    `DESCRIPTION:${escapeIcsText(`${e.description ? `${e.description}\n\n` : ""}Details: ${e.url}`)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
