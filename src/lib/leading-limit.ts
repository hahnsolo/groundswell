import { isActive, type Stage } from "./stages";

// How many active causes one person can lead (or, with co-leaders, co-lead) at
// once, so every cause on the board has someone pushing it and nobody floods a
// neighbourhood. Won and closed causes don't count. Admins aren't limited.
export const MAX_LEADING_CAUSES = 3;

/** How many of these causes are still active (not won, closed or removed). */
export function countActive(causes: { stage: string; removedAt?: Date | null }[]) {
  return causes.filter((c) => !c.removedAt && isActive(c.stage as Stage)).length;
}

/**
 * Whether someone can take on one more cause. People already over the limit
 * keep what they lead; they just can't add another until they're under it.
 */
export function canLeadAnother(activeCount: number, isAdmin = false) {
  return isAdmin || activeCount < MAX_LEADING_CAUSES;
}

export const LIMIT_REACHED = `You're leading ${MAX_LEADING_CAUSES} active causes, the most at once. To take on another, finish one: mark it won, close it, or hand it over.`;
