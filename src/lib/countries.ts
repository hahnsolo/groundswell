// Country-specific postal code rules. Adding a country = adding an entry here
// (zippopotam.us, the default lookup provider, covers ~60 countries).

export type CountryConfig = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  postalLabel: string;
  placeholder: string;
  pattern: RegExp;
  // Reduce a user-entered code to the granularity we store and look up.
  // We deliberately keep this coarse (e.g. Canadian FSA) so a stored issue
  // never pinpoints anyone's home.
  normalize: (raw: string) => string;
  // Display form of a normalized code.
  format: (normalized: string) => string;
};

export const COUNTRIES: CountryConfig[] = [
  {
    code: "US",
    name: "United States",
    postalLabel: "ZIP code",
    placeholder: "e.g. 90210",
    pattern: /^\d{5}(-?\d{4})?$/,
    normalize: (raw) => raw.replace(/\s/g, "").slice(0, 5),
    format: (n) => n,
  },
  {
    code: "CA",
    name: "Canada",
    postalLabel: "Postal code",
    placeholder: "e.g. M5V 2T6",
    pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z](\s?\d[ABCEGHJ-NPRSTV-Z]\d)?$/i,
    normalize: (raw) => raw.replace(/\s/g, "").toUpperCase().slice(0, 3),
    format: (n) => n,
  },
];

export function getCountry(code: string | undefined | null) {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export type ParsedPostal =
  | { ok: true; country: CountryConfig; postal: string }
  | { ok: false; error: string };

export function parsePostal(countryCode: string, raw: string): ParsedPostal {
  const country = getCountry(countryCode);
  if (!country) return { ok: false, error: "We don't support that country yet." };
  const trimmed = raw.trim();
  if (!country.pattern.test(trimmed)) {
    return { ok: false, error: `That doesn't look like a valid ${country.postalLabel}.` };
  }
  return { ok: true, country, postal: country.normalize(trimmed) };
}

export function areaHref(country: string, postal: string) {
  return `/area/${country.toLowerCase()}/${encodeURIComponent(postal)}`;
}
