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

/** "started by Dev · led by Maya" when they differ. */
export function leadershipLine(starter: string, leader: string, sameperson: boolean) {
  return sameperson ? `started by ${starter}` : `started by ${starter} · led by ${leader}`;
}
