// Who leads a cause, and handing the lead to someone else. The person who
// started a cause leads it until they hand it over; the new leader then has
// everything the starter had (editing, status, events, the 24-hour chat wait
// doesn't apply), and the starter stays on as a member.

const DAY = 24 * 60 * 60 * 1000;

/** An offer to take over a cause lapses if it isn't answered. */
export const LEAD_OFFER_DAYS = 7;

type Offer = { createdAt: Date; answeredAt: Date | null };

export function offerOpen(offer: Offer | null | undefined, now = Date.now()) {
  return !!offer && !offer.answeredAt && now - offer.createdAt.getTime() < LEAD_OFFER_DAYS * DAY;
}

/** Whether `leaderId` can offer the lead of their cause to `toUserId`. */
export function canOfferLead(
  cause: { leaderId: string; removedAt: Date | null },
  viewerId: string | null | undefined,
  to: { userId: string; isMember: boolean },
) {
  if (!viewerId || cause.leaderId !== viewerId || cause.removedAt) return "Only the person leading this cause can hand it over.";
  if (to.userId === viewerId) return "You already lead this cause.";
  if (!to.isMember) return "You can only hand a cause to someone who has joined it.";
  return null;
}

/**
 * "started by Dev · led by Maya" when they differ; with co-leaders,
 * "started by Dev · led by Dev and Maya".
 */
export function leadershipLine(starter: string, leader: string, sameperson: boolean, coLeaders: string[] = []) {
  if (coLeaders.length === 0) return sameperson ? `started by ${starter}` : `started by ${starter} · led by ${leader}`;
  return `started by ${starter} · led by ${joinNames([leader, ...coLeaders])}`;
}

function joinNames(names: string[]) {
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// ---------- Co-leaders (#42) ----------
// The leader can invite up to 2 members to share leading. Co-leaders can do
// everything the leader does (edit, move it forward, log, win, close, reopen)
// except hand it over and manage co-leaders. Co-leading counts toward the
// 3-active-causes limit.

export const MAX_CO_LEADERS = 2;

type CoLead = { userId: string; acceptedAt: Date | null; createdAt: Date };
type Led = { leaderId: string; coLeaders?: CoLead[] };

/** An invite to co-lead is open until accepted, or 7 days old. */
export function coLeadInviteOpen(c: CoLead, now = Date.now()) {
  return !c.acceptedAt && now - c.createdAt.getTime() < LEAD_OFFER_DAYS * DAY;
}

/** The leader, or a co-leader who accepted. */
export function leadsCause(cause: Led, viewerId: string | null | undefined) {
  if (!viewerId) return false;
  return cause.leaderId === viewerId || !!cause.coLeaders?.some((c) => c.userId === viewerId && c.acceptedAt);
}

/** Co-leaders who accepted, plus invites still open: these take up the 2 places. */
export function coLeadPlacesTaken(cause: Led, now = Date.now()) {
  return (cause.coLeaders ?? []).filter((c) => c.acceptedAt || coLeadInviteOpen(c, now)).length;
}

/** Whether the viewer can invite `to` to co-lead. Returns what's wrong, or null. */
export function canInviteCoLeader(
  cause: Led & { removedAt: Date | null },
  viewerId: string | null | undefined,
  to: { userId: string; isMember: boolean },
  now = Date.now(),
) {
  if (!viewerId || cause.leaderId !== viewerId || cause.removedAt) return "Only the person leading this cause can invite co-leaders.";
  if (to.userId === viewerId) return "You already lead this cause.";
  if (!to.isMember) return "You can only invite someone who has joined the cause.";
  const existing = cause.coLeaders?.find((c) => c.userId === to.userId);
  if (existing?.acceptedAt) return "They already co-lead this cause.";
  if (existing && coLeadInviteOpen(existing, now)) return "They've already been invited.";
  if (coLeadPlacesTaken(cause, now) >= MAX_CO_LEADERS) return `A cause can have up to ${MAX_CO_LEADERS} co-leaders.`;
  return null;
}
