import { describe, expect, it } from "vitest";
import sample from "./fixtures/represent-toronto-centre.json";
import { isStale, leadRep, levelOf, levelOrder, mergeReps, parseRepresent, probePoints, repTarget, spansSeveralWards, type Rep } from "@/lib/representatives";

const DAY = 24 * 60 * 60 * 1000;

describe("Open North's answer", () => {
  const reps = parseRepresent(sample);

  it("sorts everyone into city, province and federal", () => {
    expect(reps.map((r) => `${r.level}:${r.office}`).sort()).toEqual(["federal:MP", "municipal:Councillor", "municipal:Mayor", "provincial:MPP"]);
  });

  it("keeps contact details when they're given", () => {
    const mp = reps.find((r) => r.office === "MP")!;
    expect(mp.email).toMatch(/@parl\.gc\.ca$/);
    expect(mp.district).toBe("Toronto Centre");
  });

  it("copes with an empty or odd answer", () => {
    expect(parseRepresent({})).toEqual([]);
    expect(parseRepresent({ objects: [{ name: "No office" }] })).toEqual([]);
  });
});

describe("levels", () => {
  it("knows provincial titles in every province", () => {
    for (const office of ["MPP", "MLA", "MNA", "MHA"]) expect(levelOf(office)).toBe("provincial");
    expect(levelOf("Member", "Assemblée nationale du Québec")).toBe("provincial");
    expect(levelOf("MP")).toBe("federal");
    expect(levelOf("Councillor", "Vancouver City Council")).toBe("municipal");
  });

  it("shows the level the starter chose first, else guesses from the category", () => {
    expect(levelOrder("province", "transit")).toEqual(["provincial", "municipal", "federal"]);
    expect(levelOrder("federal", "transit")).toEqual(["federal", "municipal", "provincial"]);
    expect(levelOrder("unsure", "housing")).toEqual(["provincial", "municipal", "federal"]);
    expect(levelOrder("landlord", "parks")).toEqual(["municipal", "provincial", "federal"]);
  });
});

describe("areas that straddle boundaries", () => {
  const ward = (name: string, district: string): Rep => ({ name, office: "Councillor", district, level: "municipal" });

  it("asks about the centre and four nearby points", () => {
    const pts = probePoints(43.65, -79.37);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual([43.65, -79.37]);
  });

  it("keeps each person once, and notices more than one ward", () => {
    const merged = mergeReps([[ward("A", "Ward 10")], [ward("A", "Ward 10"), ward("B", "Ward 11")]]);
    expect(merged).toHaveLength(2);
    expect(spansSeveralWards(merged)).toBe(true);
    expect(spansSeveralWards([ward("A", "Ward 10")])).toBe(false);
  });
});

describe("campaigns and freshness", () => {
  const reps = parseRepresent(sample);

  it("addresses a councillor before the mayor", () => {
    expect(leadRep(reps, "municipal")?.office).toBe("Councillor");
    expect(repTarget(leadRep(reps, "federal")!)).toBe("MP Evan Solomon, Toronto Centre");
  });

  it("checks again after 30 days", () => {
    const now = Date.now();
    expect(isStale(new Date(now - 29 * DAY), now)).toBe(false);
    expect(isStale(new Date(now - 31 * DAY), now)).toBe(true);
  });
});
