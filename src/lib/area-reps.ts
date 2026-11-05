import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { isStale, mergeReps, parseRepresent, probePoints, type Rep } from "./representatives";

// Representatives per area (Canada only for now; US is #39). Looked up once by
// the area's centre (plus four nearby points), saved, and checked again after
// 30 days. Pages never wait on a re-check: they get the saved list while it
// refreshes in the background, and if Open North is down they keep the last one.

type Area = { country: string; postalCode: string; lat: number; lng: number };
export type AreaReps = { reps: Rep[]; checkedAt: Date };

async function lookUp(lat: number, lng: number): Promise<Rep[]> {
  const lists: Rep[][] = [];
  // One point at a time: Open North allows about 60 requests a minute.
  for (const [pLat, pLng] of probePoints(lat, lng)) {
    const res = await fetch(`https://represent.opennorth.ca/representatives/?point=${pLat.toFixed(5)},${pLng.toFixed(5)}&limit=100`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Open North answered ${res.status}`);
    lists.push(parseRepresent(await res.json()));
  }
  return mergeReps(lists);
}

async function refresh(area: Area): Promise<AreaReps> {
  const reps = await lookUp(area.lat, area.lng);
  const key = { country: area.country, postalCode: area.postalCode };
  const row = await db.areaRepresentatives.upsert({
    where: { country_postalCode: key },
    create: { ...key, reps, checkedAt: new Date() },
    update: { reps, checkedAt: new Date() },
  });
  return { reps: row.reps as Rep[], checkedAt: row.checkedAt };
}

/** The representatives for a cause's area, or null if we don't cover the country or the lookup failed the first time. */
export async function getAreaReps(area: Area): Promise<AreaReps | null> {
  if (area.country !== "CA") return null;
  const saved = await db.areaRepresentatives.findUnique({
    where: { country_postalCode: { country: area.country, postalCode: area.postalCode } },
  });
  if (saved) {
    if (isStale(saved.checkedAt)) {
      after(() => refresh(area).catch((e) => console.warn("Representatives refresh failed:", (e as Error).message)));
    }
    return { reps: saved.reps as Rep[], checkedAt: saved.checkedAt };
  }
  try {
    return await refresh(area);
  } catch (e) {
    console.warn("Representatives lookup failed:", (e as Error).message);
    return null;
  }
}

/** For the daily job: re-check a few of the oldest saved areas, so busy pages rarely need to. */
export async function refreshStaleAreaReps(limit = 20) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await db.areaRepresentatives.findMany({ where: { checkedAt: { lt: cutoff } }, orderBy: { checkedAt: "asc" }, take: limit });
  let refreshed = 0;
  for (const row of stale) {
    // Any cause in the area gives us its centre point.
    const cause = await db.cause.findFirst({ where: { country: row.country, postalCode: row.postalCode }, select: { lat: true, lng: true } });
    if (!cause) continue;
    try {
      await refresh({ country: row.country, postalCode: row.postalCode, lat: cause.lat, lng: cause.lng });
      refreshed++;
    } catch (e) {
      console.warn(`Representatives refresh failed for ${row.country}-${row.postalCode}:`, (e as Error).message);
    }
  }
  return refreshed;
}
