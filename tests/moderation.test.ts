import { describe, expect, it } from "vitest";
import {
  cleanRemovalReason,
  isRestorable,
  MAX_REMOVAL_REASON,
  permanentDeletionDate,
  purgeCutoff,
  REMOVAL_RETENTION_DAYS,
  shouldAutoHide,
} from "@/lib/moderation";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-18T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe("auto-hide after reports", () => {
  it("hides at 3 reports from established accounts, not before", () => {
    expect(shouldAutoHide(0)).toBe(false);
    expect(shouldAutoHide(2)).toBe(false);
    expect(shouldAutoHide(3)).toBe(true);
    expect(shouldAutoHide(10)).toBe(true);
  });
});

describe("removal retention", () => {
  it("keeps removed content for one week", () => {
    expect(REMOVAL_RETENTION_DAYS).toBe(7);
  });

  it("deletes content exactly 7 days after removal", () => {
    expect(permanentDeletionDate(now)).toEqual(new Date("2026-10-25T12:00:00Z"));
  });

  it("purges only content removed more than 7 days ago", () => {
    const cutoff = purgeCutoff(now);
    expect(daysAgo(8) < cutoff).toBe(true); // purged
    expect(daysAgo(6) < cutoff).toBe(false); // kept
  });

  it("lets a moderator restore within the week, not after", () => {
    expect(isRestorable(daysAgo(0), now)).toBe(true);
    expect(isRestorable(daysAgo(6.9), now)).toBe(true);
    expect(isRestorable(daysAgo(7.1), now)).toBe(false);
  });

  it("agrees with itself: restorable until the deletion date", () => {
    const removedAt = daysAgo(3);
    const justBefore = new Date(permanentDeletionDate(removedAt).getTime() - 1000);
    const justAfter = new Date(permanentDeletionDate(removedAt).getTime() + 1000);
    expect(isRestorable(removedAt, justBefore)).toBe(true);
    expect(isRestorable(removedAt, justAfter)).toBe(false);
  });
});

describe("removal reason", () => {
  it("trims, and treats blank or missing as no reason", () => {
    expect(cleanRemovalReason("  spam  ")).toBe("spam");
    expect(cleanRemovalReason("   ")).toBeNull();
    expect(cleanRemovalReason(null)).toBeNull();
    expect(cleanRemovalReason(undefined)).toBeNull();
  });

  it("caps long reasons", () => {
    expect(cleanRemovalReason("x".repeat(500))).toHaveLength(MAX_REMOVAL_REASON);
  });
});
