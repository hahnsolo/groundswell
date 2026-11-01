// Who the person starting a cause thinks should fix it. Shown on the cause
// ("Asking: the city"), used to pre-fill a campaign's target, and later to
// pick which representative to show first (#36, #39).

export const FIXERS = [
  { id: "city", label: "City or town", emoji: "🏙️", asking: "the city" },
  { id: "province", label: "Province", labelUS: "State", emoji: "🏛️", asking: "the province", askingUS: "the state" },
  { id: "federal", label: "Federal government", emoji: "🍁", emojiUS: "🦅", asking: "the federal government" },
  { id: "landlord", label: "Landlord or property owner", emoji: "🏢", asking: "the landlord" },
  { id: "business", label: "A business", emoji: "🏪", asking: "a business" },
  { id: "nonprofit", label: "A non-profit or community group", emoji: "🤝", asking: "a community group" },
  { id: "other", label: "Something else", emoji: "📌", asking: "" },
  { id: "unsure", label: "Not sure", emoji: "❔", asking: "" },
] as const;

export type FixerId = (typeof FIXERS)[number]["id"];
export const FIXER_IDS = FIXERS.map((f) => f.id) as [FixerId, ...FixerId[]];
export const FIXER_OTHER_MAX = 80;

type Fixer = (typeof FIXERS)[number];
const us = (country: string) => country === "US";

/** The choice as offered on the form, worded for the cause's country. */
export function fixerLabel(f: Fixer, country: string) {
  return us(country) && "labelUS" in f ? f.labelUS : f.label;
}

export function getFixer(id: string | null | undefined) {
  return FIXERS.find((f) => f.id === id) ?? FIXERS[FIXERS.length - 1];
}

/**
 * How a cause shows who it's asking: "the city", "the state", or what the
 * person wrote for "Something else". Null when they're not sure.
 */
export function askingWhom(id: string | null | undefined, other: string | null | undefined, country: string) {
  const f = getFixer(id);
  if (f.id === "unsure") return null;
  if (f.id === "other") return other?.trim() || null;
  return us(country) && "askingUS" in f ? f.askingUS : f.asking;
}

export function fixerEmoji(id: string | null | undefined, country: string) {
  const f = getFixer(id);
  return us(country) && "emojiUS" in f ? f.emojiUS : f.emoji;
}

/** A starting point for a campaign's "Who can fix this?" field. */
export function campaignTargetFor(id: string | null | undefined, other: string | null | undefined, country: string, place: string) {
  const f = getFixer(id);
  switch (f.id) {
    case "city":
      return `City council for ${place}`;
    case "province":
      return us(country) ? "State legislators for this area" : "The provincial representative (MPP / MLA) for this area";
    case "federal":
      return us(country) ? "Members of Congress for this area" : "The MP for this area";
    case "other":
      return other?.trim() ?? "";
    case "unsure":
      return "";
    default:
      return f.asking.replace(/^the /, "The ").replace(/^a /, "A ");
  }
}
