import { describe, expect, it } from "vitest";
import { canLeadAnother, countActive, MAX_LEADING_CAUSES } from "@/lib/leading-limit";

describe("the leading limit", () => {
  it("is 3", () => expect(MAX_LEADING_CAUSES).toBe(3));

  it("counts only active causes: won, closed and removed ones don't count", () => {
    expect(
      countActive([
        { stage: "raised" },
        { stage: "gathering" },
        { stage: "organizing" },
        { stage: "taking_action" },
        { stage: "won" },
        { stage: "closed" },
        { stage: "raised", removedAt: new Date() },
      ]),
    ).toBe(4);
    expect(countActive([])).toBe(0);
  });

  it("lets people start causes until they lead 3", () => {
    expect(canLeadAnother(0)).toBe(true);
    expect(canLeadAnother(2)).toBe(true);
    expect(canLeadAnother(3)).toBe(false);
  });

  it("doesn't take anything away from people already over it, but stops them adding more", () => {
    expect(canLeadAnother(5)).toBe(false);
  });

  it("doesn't limit admins", () => expect(canLeadAnother(10, true)).toBe(true));
});
