// How a cause is moving, in a few words, for the cards on neighbourhood pages.
// Kept free of database code so it's easy to test.

const DAY = 24 * 60 * 60 * 1000;

/** Wins stay in the spotlight this long. */
export const RECENT_WIN_DAYS = 30;
/** A meetup this soon counts as "coming up". */
const MEETING_SOON_DAYS = 14;

export type Momentum =
  | { kind: "won"; at: Date | null }
  | { kind: "meeting"; startsAt: Date }
  | { kind: "asking"; signed: number; goal: number }
  | { kind: "growing"; joinedThisWeek: number }
  | { kind: "new" }
  | null;

export function momentum(
  c: {
    status: string;
    resolvedAt?: Date | null;
    createdAt: Date;
    nextMeetup?: { startsAt: Date } | null;
    campaign?: { signed: number; goal: number } | null;
    joinedThisWeek: number;
  },
  now = new Date(),
): Momentum {
  if (c.status === "resolved") return { kind: "won", at: c.resolvedAt ?? null };
  if (c.nextMeetup && c.nextMeetup.startsAt.getTime() - now.getTime() < MEETING_SOON_DAYS * DAY) {
    return { kind: "meeting", startsAt: c.nextMeetup.startsAt };
  }
  if (c.campaign) return { kind: "asking", ...c.campaign };
  if (c.joinedThisWeek > 0) return { kind: "growing", joinedThisWeek: c.joinedThisWeek };
  if (now.getTime() - c.createdAt.getTime() < 7 * DAY) return { kind: "new" };
  return null;
}

export function isRecentWin(resolvedAt: Date | null | undefined, now = new Date()) {
  return !!resolvedAt && now.getTime() - resolvedAt.getTime() < RECENT_WIN_DAYS * DAY;
}

/**
 * "Priya cares", "Priya and Sam care", "Priya, Sam and 12 neighbours care".
 * `names` are the first few supporters (people who've left are already
 * filtered out); `total` counts everyone, including them.
 */
export function peopleLine(names: string[], total: number, verb: "care" | "joined" = "care") {
  if (total <= 0) return verb === "care" ? "Be the first to care" : "Be the first to join";
  const one = verb === "care" ? "cares" : "has joined";
  const many = verb === "care" ? "care" : "have joined";
  const shown = names.slice(0, 2).slice(0, total);
  const others = total - shown.length;
  const neighbours = (n: number) => `${n} neighbour${n === 1 ? "" : "s"}`;
  if (shown.length === 0) return `${neighbours(total)} ${total === 1 ? one : many}`;
  if (others === 0) return shown.length === 1 ? `${shown[0]} ${one}` : `${shown[0]} and ${shown[1]} ${many}`;
  // Exactly one more, and we know their name: just say it.
  if (others === 1 && shown.length === 2 && names[2]) return `${shown[0]}, ${shown[1]} and ${names[2]} ${many}`;
  return `${shown.join(", ")} and ${shown.length === 1 && others === 1 ? "1 other" : neighbours(others)} ${many}`;
}
