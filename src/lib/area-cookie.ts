// The header remembers the last neighbourhood you looked at, in a cookie that
// holds only the area code and its name ("CA-M5V|Downtown Toronto") — never an
// address. Shared by the server (first render) and the browser.

export const AREA_COOKIE = "gs_area";

export type Area = { country: string; postal: string; name: string };

export function encodeArea(a: Area) {
  return encodeURIComponent(`${a.country}-${a.postal}|${a.name}`);
}

export function decodeArea(raw: string | undefined | null): Area | null {
  if (!raw) return null;
  try {
    const [code, name] = decodeURIComponent(raw).split("|");
    const [country, postal] = (code ?? "").split("-");
    if (!/^[A-Z]{2}$/.test(country ?? "") || !postal || !name) return null;
    return { country, postal: postal.slice(0, 10), name: name.slice(0, 60) };
  } catch {
    return null;
  }
}
