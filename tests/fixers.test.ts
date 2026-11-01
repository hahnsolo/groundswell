import { describe, expect, it } from "vitest";
import { askingWhom, campaignTargetFor, fixerEmoji, fixerLabel, FIXERS, getFixer } from "@/lib/fixers";

const province = FIXERS.find((f) => f.id === "province")!;

describe("who should fix a cause", () => {
  it("says Province in Canada and State in the US", () => {
    expect(fixerLabel(province, "CA")).toBe("Province");
    expect(fixerLabel(province, "US")).toBe("State");
    expect(askingWhom("province", null, "CA")).toBe("the province");
    expect(askingWhom("province", null, "US")).toBe("the state");
  });

  it("uses what the person wrote for Something else", () => {
    expect(askingWhom("other", "  The school board ", "CA")).toBe("The school board");
    expect(askingWhom("other", "   ", "CA")).toBeNull();
  });

  it("shows nothing to ask when they're not sure, or for causes from before this existed", () => {
    expect(askingWhom("unsure", null, "CA")).toBeNull();
    expect(askingWhom(null, null, "CA")).toBeNull();
    expect(getFixer("nonsense").id).toBe("unsure");
  });

  it("picks a flag-appropriate emoji for federal", () => {
    expect(fixerEmoji("federal", "CA")).toBe("🍁");
    expect(fixerEmoji("federal", "US")).toBe("🦅");
  });

  it("gives campaigns a sensible starting target", () => {
    expect(campaignTargetFor("city", null, "CA", "Downtown Toronto")).toBe("City council for Downtown Toronto");
    expect(campaignTargetFor("federal", null, "CA", "x")).toBe("The MP for this area");
    expect(campaignTargetFor("federal", null, "US", "x")).toBe("Members of Congress for this area");
    expect(campaignTargetFor("landlord", null, "CA", "x")).toBe("The landlord");
    expect(campaignTargetFor("nonprofit", null, "CA", "x")).toBe("A community group");
    expect(campaignTargetFor("other", "The TTC", "CA", "x")).toBe("The TTC");
    expect(campaignTargetFor("unsure", null, "CA", "x")).toBe("");
  });
});
