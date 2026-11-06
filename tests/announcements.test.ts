import { describe, expect, it } from "vitest";
import { announcementsLeft } from "@/lib/announcements";

describe("the weekly cap (#73)", () => {
  it("allows 3 a week", () => {
    expect(announcementsLeft(0)).toBe(3);
    expect(announcementsLeft(2)).toBe(1);
    expect(announcementsLeft(3)).toBe(0);
    expect(announcementsLeft(9)).toBe(0);
  });
});
