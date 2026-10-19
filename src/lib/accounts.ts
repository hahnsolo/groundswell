// Rules for leaving: deleted accounts and meetup handovers. Kept free of
// database code so they're easy to test; src/lib/leaving.ts applies them.

const DAY = 24 * 60 * 60 * 1000;

/** Signing back in within this many days of deleting restores the account. */
export const ACCOUNT_GRACE_DAYS = 30;

/** Shown instead of the name of anyone who has deleted their account. */
export const FORMER_MEMBER = "Former member";

/** Accounts deactivated before this moment are due to be anonymized. */
export function anonymizeCutoff(now = new Date()) {
  return new Date(now.getTime() - ACCOUNT_GRACE_DAYS * DAY);
}

/** When an account deactivated at `deactivatedAt` will be anonymized for good. */
export function anonymizeDate(deactivatedAt: Date) {
  return new Date(deactivatedAt.getTime() + ACCOUNT_GRACE_DAYS * DAY);
}

/**
 * A unique placeholder that replaces the email of an anonymized account. The
 * `.invalid` domain is reserved and can never receive mail, and freeing the
 * real address lets the person sign up again one day.
 */
export function anonymizedEmail(userId: string) {
  return `deleted-${userId}@deleted.invalid`;
}

/** The name to show for a person, hiding it once they've deleted their account. */
export function displayName(user: { name: string; deactivatedAt?: Date | null }) {
  return user.deactivatedAt ? FORMER_MEMBER : user.name;
}

export type RsvpCandidate = { userId: string; createdAt: Date; active: boolean };

/**
 * Who takes over a meetup when its host leaves: the earliest person who said
 * they're going and still has an account. null means nobody, so it's cancelled.
 */
export function pickNewHost(rsvps: RsvpCandidate[], leavingUserId: string) {
  const next = rsvps
    .filter((r) => r.active && r.userId !== leavingUserId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  return next?.userId ?? null;
}
