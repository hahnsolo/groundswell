// How a chat groups messages (#70). Pure, so it's easy to test.

/** Messages from the same person this close together are shown as one group (no repeated name). */
export const GROUP_WITHIN_MS = 10 * 60 * 1000;

export function startsGroup(prev: { authorId: string; createdAt: Date; removed: boolean } | null, cur: { authorId: string; createdAt: Date }) {
  return !prev || prev.removed || prev.authorId !== cur.authorId || cur.createdAt.getTime() - prev.createdAt.getTime() > GROUP_WITHIN_MS;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The separator above a message when a new day starts (in the viewer's own
 * time zone): "Today", "Yesterday", the weekday within the week, else the
 * date. Null when it's the same day as the message before.
 */
export function dayLabel(d: Date, prev: Date | null, now: Date, locale?: string) {
  if (prev && sameDay(prev, d)) return null;
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  const daysAgo = (now.getTime() - d.getTime()) / 86_400_000;
  if (daysAgo > 0 && daysAgo < 6) return d.toLocaleDateString(locale, { weekday: "long" });
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}
