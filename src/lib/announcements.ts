// Announcements (#73): the weekly cap, and one daily email per person that
// bundles their announcements with their reminders, so a 100-member cause
// doesn't use up the email budget at once. Pure, so it's easy to test.

export const MAX_ANNOUNCEMENTS_PER_WEEK = 3;
export const MAX_ANNOUNCEMENT_LENGTH = 1000;
/** News older than this isn't worth sending any more. */
export const NOTICE_EXPIRES_DAYS = 7;

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const weekAgo = (now = new Date()) => new Date(now.getTime() - WEEK);

/** How many more a cause can post this week. */
export const announcementsLeft = (postedThisWeek: number) => Math.max(0, MAX_ANNOUNCEMENTS_PER_WEEK - postedThisWeek);

export type Bundle<U, R, A> = { user: U; reminders: R[]; announcements: A[] };

/**
 * One bundle per person. People with a reminder come first, then whoever's
 * been waiting longest, so a tight budget goes to what's most time-sensitive.
 */
export function buildBundles<U extends { id: string }, R, A extends { createdAt: Date }>(reminders: { user: U; reminder: R }[], notices: { user: U; announcement: A }[]) {
  const byUser = new Map<string, Bundle<U, R, A>>();
  const bundleFor = (user: U) => {
    const existing = byUser.get(user.id);
    if (existing) return existing;
    const created: Bundle<U, R, A> = { user, reminders: [], announcements: [] };
    byUser.set(user.id, created);
    return created;
  };
  for (const r of reminders) bundleFor(r.user).reminders.push(r.reminder);
  for (const n of notices) bundleFor(n.user).announcements.push(n.announcement);
  const oldest = (b: Bundle<U, R, A>) => Math.min(...b.announcements.map((a) => a.createdAt.getTime()), Infinity);
  return [...byUser.values()]
    .map((b) => ({ ...b, announcements: [...b.announcements].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()) }))
    .sort((a, b) => Number(b.reminders.length > 0) - Number(a.reminders.length > 0) || oldest(a) - oldest(b));
}

/** What fits today's budget; the rest carries over to tomorrow morning. */
export function splitByBudget<T>(bundles: T[], left: number) {
  return { send: bundles.slice(0, left), carry: bundles.slice(left) };
}
