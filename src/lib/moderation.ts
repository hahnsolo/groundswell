// Moderation rules, kept free of database code so they're easy to test.

const DAY = 24 * 60 * 60 * 1000;

/** Reports from established accounts that hide content until a moderator decides. */
export const REPORTS_TO_HIDE = 3;

/** Only reporters older than this count toward auto-hiding, so throwaway accounts can't silence people. */
export const ESTABLISHED_ACCOUNT_MS = DAY;

/**
 * Removed content is kept this long so a moderator can undo a mistake (and the
 * author can see what happened), then deleted for good by the daily purge.
 */
export const REMOVAL_RETENTION_DAYS = 7;

export const MAX_REMOVAL_REASON = 200;

export function shouldAutoHide(establishedReports: number) {
  return establishedReports >= REPORTS_TO_HIDE;
}

/** Content removed before this moment is due for permanent deletion. */
export function purgeCutoff(now = new Date()) {
  return new Date(now.getTime() - REMOVAL_RETENTION_DAYS * DAY);
}

/** When content removed at `removedAt` will be deleted for good. */
export function permanentDeletionDate(removedAt: Date) {
  return new Date(removedAt.getTime() + REMOVAL_RETENTION_DAYS * DAY);
}

/** Whether removed content can still be restored (it hasn't reached its deletion date). */
export function isRestorable(removedAt: Date, now = new Date()) {
  return removedAt > purgeCutoff(now);
}

/** Tidies a moderator's free-text reason: trimmed, capped, empty → null. */
export function cleanRemovalReason(raw: unknown) {
  if (typeof raw !== "string") return null;
  const reason = raw.trim().slice(0, MAX_REMOVAL_REASON);
  return reason || null;
}
