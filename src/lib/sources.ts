// Where people came from (#67): the flyer, WhatsApp, Instagram… Links and QR
// codes carry a source tag; the page remembers it in a cookie for that cause
// or event, and joining (or saying you're going) saves it once, on that
// person's membership. Leaders then see "9 came from the flyer, 14 from WhatsApp".
// Pure, so it's easy to test. Nothing about the person is tracked: just the tag.

export const SOURCES = {
  flyer: { label: "the flyer", short: "" },
  whatsapp: { label: "WhatsApp", short: "wa" },
  instagram: { label: "Instagram", short: "ig" },
  facebook: { label: "Facebook", short: "fb" },
  email: { label: "email", short: "em" },
  text: { label: "text messages", short: "tx" },
  link: { label: "a shared link", short: "ln" },
} as const;

export type Source = keyof typeof SOURCES;

/** The places someone can say they're sharing to (the flyer is printed instead). */
export const SHARE_PLACES: Source[] = ["whatsapp", "instagram", "facebook", "email", "text", "link"];

/** A tag from a link (`?src=whatsapp`) or a short path (`/go/k7m2qp/wa`), or null if it isn't one of ours. */
export function readSource(value: string | null | undefined): Source | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().slice(0, 20);
  if (v in SOURCES) return v as Source;
  const byShort = (Object.keys(SOURCES) as Source[]).find((k) => SOURCES[k].short && SOURCES[k].short === v);
  return byShort ?? null;
}

/** The cookie that remembers how someone arrived at a cause or event (one per page, so they don't mix). */
export const sourceCookie = (id: string) => `gs_src_${id}`;
export const SOURCE_COOKIE_DAYS = 30;

/** The first tag wins: someone who saw the flyer and later got a WhatsApp link came from the flyer. */
export function keepFirst(existing: string | null | undefined, incoming: string | null | undefined): Source | null {
  return readSource(existing) ?? readSource(incoming);
}

/** A page link tagged for where it's being shared. */
export function taggedUrl(pageUrl: string, source: Source) {
  return `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}src=${source}`;
}

/** The short link printed on flyers and posts, e.g. groundswell.hahnsolo.ca/go/k7m2qp (the flyer) or …/go/k7m2qp/ig. */
export function shortUrl(appUrl: string, code: string, source: Source = "flyer") {
  const s = SOURCES[source].short;
  return `${appUrl.replace(/\/+$/, "")}/go/${code}${s ? `/${s}` : ""}`;
}

/** The same link without "https://", for printing so people can type it. */
export const typedLink = (url: string) => url.replace(/^https?:\/\//, "");

/** Letters and digits that can't be mistaken for each other when typed from paper (no 0/o, 1/l/i). */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 6;

export function makeShortCode(random: () => number = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export function isShortCode(value: string) {
  return value.length === CODE_LENGTH && [...value].every((c) => CODE_ALPHABET.includes(c));
}

/** "9 people came from the flyer, 14 from WhatsApp" (biggest first), or null when nobody's tagged yet. */
export function sourceSummary(rows: { source: string | null; count: number }[], verb = "came") {
  const counts = new Map<Source, number>();
  for (const r of rows) {
    const s = readSource(r.source);
    if (s && r.count > 0) counts.set(s, (counts.get(s) ?? 0) + r.count);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  return sorted
    .map(([s, n], i) => (i === 0 ? `${n} ${n === 1 ? "person" : "people"} ${verb} from ${SOURCES[s].label}` : `${n} from ${SOURCES[s].label}`))
    .join(", ");
}
