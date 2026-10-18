import "server-only";
import { db } from "./db";
import { getCountry } from "./countries";

export type ResolvedPlace = {
  id: string;
  country: string;
  postalCode: string;
  placeName: string;
  region: string;
  regionCode: string;
  lat: number;
  lng: number;
};

type ZippopotamResponse = {
  places?: {
    "place name": string;
    latitude: string;
    longitude: string;
    state: string;
    "state abbreviation": string;
  }[];
};

// Canadian FSA names come back like "Downtown Toronto (CN Tower / King and Spadina / ...)".
function tidyPlaceName(name: string) {
  return name.split(" (")[0].trim();
}

/**
 * Resolve a normalized postal code to a named place with coordinates.
 * Results are cached in the Place table, so each code hits the external
 * provider at most once.
 */
export async function resolvePlace(countryCode: string, postal: string): Promise<ResolvedPlace | null> {
  const country = getCountry(countryCode);
  if (!country) return null;
  const id = `${country.code}-${postal}`;

  const cached = await db.place.findUnique({ where: { id } });
  if (cached) return cached;

  let data: ZippopotamResponse;
  try {
    const res = await fetch(
      `https://api.zippopotam.us/${country.code.toLowerCase()}/${encodeURIComponent(postal)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error("Postal lookup failed", { id, err });
    throw new Error("We couldn't reach the postal code service. Please try again in a moment.");
  }

  const first = data.places?.[0];
  if (!first) return null;

  // If a code spans several places (common for US ZIPs), centre on their average.
  const places = data.places!;
  const lat = places.reduce((s, p) => s + Number(p.latitude), 0) / places.length;
  const lng = places.reduce((s, p) => s + Number(p.longitude), 0) / places.length;

  const place = {
    id,
    country: country.code,
    postalCode: postal,
    placeName: tidyPlaceName(first["place name"]),
    region: first.state,
    regionCode: first["state abbreviation"],
    lat,
    lng,
  };
  await db.place.upsert({ where: { id }, create: place, update: {} });
  return place;
}
