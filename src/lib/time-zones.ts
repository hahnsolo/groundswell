// The usual time zone for a province or state, for the rare places where we
// have to show a time without knowing the reader's (link previews, flyers,
// emails). Pages always use the reader's own time zone instead. Provinces and
// states that span zones get the one most people live in.

const CA: Record<string, string> = {
  BC: "America/Vancouver",
  AB: "America/Edmonton",
  SK: "America/Regina",
  MB: "America/Winnipeg",
  ON: "America/Toronto",
  QC: "America/Toronto",
  NB: "America/Moncton",
  NS: "America/Halifax",
  PE: "America/Halifax",
  NL: "America/St_Johns",
  YT: "America/Whitehorse",
  NT: "America/Yellowknife",
  NU: "America/Iqaluit",
};

const EASTERN = ["CT", "DE", "DC", "FL", "GA", "IN", "KY", "ME", "MD", "MA", "MI", "NH", "NJ", "NY", "NC", "OH", "PA", "RI", "SC", "VT", "VA", "WV"];
const CENTRAL = ["AL", "AR", "IL", "IA", "KS", "LA", "MN", "MS", "MO", "NE", "ND", "OK", "SD", "TN", "TX", "WI"];
const MOUNTAIN = ["CO", "ID", "MT", "NM", "UT", "WY"];
const PACIFIC = ["CA", "NV", "OR", "WA"];

const US: Record<string, string> = {
  ...Object.fromEntries(EASTERN.map((s) => [s, "America/New_York"])),
  ...Object.fromEntries(CENTRAL.map((s) => [s, "America/Chicago"])),
  ...Object.fromEntries(MOUNTAIN.map((s) => [s, "America/Denver"])),
  ...Object.fromEntries(PACIFIC.map((s) => [s, "America/Los_Angeles"])),
  AZ: "America/Phoenix",
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
  PR: "America/Puerto_Rico",
};

export function zoneFor(country: string, region: string) {
  const r = region.toUpperCase();
  return (country === "CA" ? CA[r] : country === "US" ? US[r] : undefined) ?? (country === "CA" ? "America/Toronto" : "America/New_York");
}

/** "Tue, Nov 10, 6:00 p.m. EST" in the place's own time zone. */
export function placeTime(date: Date, country: string, region: string) {
  return date.toLocaleString(country === "CA" ? "en-CA" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneFor(country, region),
    timeZoneName: "short",
  });
}
