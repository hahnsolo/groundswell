// Announcements (#73): the weekly cap. Pure, so it's easy to test.

export const MAX_ANNOUNCEMENTS_PER_WEEK = 3;
export const MAX_ANNOUNCEMENT_LENGTH = 1000;

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const weekAgo = (now = new Date()) => new Date(now.getTime() - WEEK);

/** How many more a cause can post this week. */
export const announcementsLeft = (postedThisWeek: number) => Math.max(0, MAX_ANNOUNCEMENTS_PER_WEEK - postedThisWeek);
