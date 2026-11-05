// Who represents an area, from Open North's free Represent service (Canada).
// Pure, so it's easy to test against a saved sample. Fetching and saving is in
// src/lib/area-reps.ts.

export type Level = "municipal" | "provincial" | "federal";

export type Rep = {
  name: string;
  office: string; // "Councillor", "Mayor", "MPP", "MLA", "MP"…
  district: string;
  level: Level;
  party?: string;
  email?: string;
  url?: string;
};

/** How often saved representatives are checked again (elections, by-elections, resignations). */
export const REP_REFRESH_DAYS = 30;

const PROVINCIAL_OFFICES = new Set(["MPP", "MLA", "MNA", "MHA"]);

export function levelOf(office: string, setName = ""): Level {
  if (office === "MP" || /House of Commons/i.test(setName)) return "federal";
  if (PROVINCIAL_OFFICES.has(office) || /Legislative Assembly|Assembl[ée]e nationale|House of Assembly/i.test(setName)) return "provincial";
  return "municipal";
}

type RepresentObject = {
  name?: string;
  elected_office?: string;
  district_name?: string;
  representative_set_name?: string;
  party_name?: string;
  email?: string;
  url?: string;
};

/** Open North's `{ objects: [...] }` response → our representatives, without duplicates. */
export function parseRepresent(json: { objects?: RepresentObject[] }): Rep[] {
  return mergeReps([
    (json.objects ?? [])
      .filter((o) => o.name && o.elected_office)
      .map((o) => ({
        name: o.name!,
        office: o.elected_office!,
        district: o.district_name ?? "",
        level: levelOf(o.elected_office!, o.representative_set_name),
        ...(o.party_name ? { party: o.party_name } : {}),
        ...(o.email ? { email: o.email } : {}),
        ...(o.url ? { url: o.url } : {}),
      })),
  ]);
}

/** Combines lookups from several points in an area, keeping each person once. */
export function mergeReps(lists: Rep[][]): Rep[] {
  const seen = new Map<string, Rep>();
  for (const rep of lists.flat()) {
    const key = `${rep.level}|${rep.office}|${rep.name}`;
    if (!seen.has(key)) seen.set(key, rep);
  }
  return [...seen.values()];
}

/** An area like a postal district can straddle wards; then there's more than one councillor. */
export function spansSeveralWards(reps: Rep[]) {
  return reps.filter((r) => r.level === "municipal" && /councillor/i.test(r.office)).length > 1;
}

/**
 * The points we ask about: the area's centre and four points about 1.5 km
 * away, so an area that straddles a boundary shows everyone involved.
 */
export function probePoints(lat: number, lng: number) {
  const dLat = 0.0135;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return [
    [lat, lng],
    [lat + dLat, lng],
    [lat - dLat, lng],
    [lat, lng + dLng],
    [lat, lng - dLng],
  ] as const;
}

const LEVELS: Level[] = ["municipal", "provincial", "federal"];
const PROVINCIAL_FIRST_CATEGORIES = new Set(["housing", "health", "schools"]);

/** Which level to show first: who the starter said should fix it (#45), else a guess from the category. */
export function levelOrder(fixer: string | null | undefined, category: string): Level[] {
  const first: Level | null =
    fixer === "city" ? "municipal" : fixer === "province" ? "provincial" : fixer === "federal" ? "federal" : null;
  const lead = first ?? (PROVINCIAL_FIRST_CATEGORIES.has(category) ? "provincial" : "municipal");
  return [lead, ...LEVELS.filter((l) => l !== lead)];
}

export const LEVEL_NAMES: Record<Level, string> = { municipal: "City", provincial: "Province", federal: "Federal" };

export function isStale(checkedAt: Date, now = Date.now()) {
  return now - checkedAt.getTime() > REP_REFRESH_DAYS * 24 * 60 * 60 * 1000;
}

/** The person a campaign should address at a level: a councillor before the mayor. */
export function leadRep(reps: Rep[], level: Level) {
  const atLevel = reps.filter((r) => r.level === level);
  return atLevel.find((r) => /councillor/i.test(r.office)) ?? atLevel[0] ?? null;
}

/** "Councillor Chris Moise, Toronto Centre" */
export function repTarget(rep: Rep) {
  return `${rep.office} ${rep.name}${rep.district ? `, ${rep.district}` : ""}`;
}
