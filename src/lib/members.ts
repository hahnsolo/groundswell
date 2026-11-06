import "server-only";
import { db } from "./db";
import { leadsCause } from "./leadership";
import { fromLabel, type MemberRow } from "./member-list";

type Led = { id: string; leaderId: string; coLeaders?: { userId: string; acceptedAt: Date | null; createdAt: Date }[]; campaigns: { id: string }[] };

/**
 * Everyone who's joined a cause, for the people leading it (#79): when they
 * joined, whether they've signed the latest ask and are going to the next
 * event, and how they found it. Never emails. Only call this for its leaders.
 */
export async function getMemberRows(cause: Led, viewerId: string, nextEventId: string | null): Promise<MemberRow[]> {
  const latestAsk = cause.campaigns[0]?.id ?? null;
  const [members, signed, going] = await Promise.all([
    db.causeMember.findMany({
      where: { causeId: cause.id, user: { deactivatedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { createdAt: true, source: true, invitedById: true, user: { select: { id: true, name: true, showName: true } } },
    }),
    latestAsk ? db.signature.findMany({ where: { campaignId: latestAsk }, select: { userId: true } }) : [],
    nextEventId ? db.rsvp.findMany({ where: { meetupId: nextEventId }, select: { userId: true } }) : [],
  ]);
  const signedIds = new Set(signed.map((s) => s.userId));
  const goingIds = new Set(going.map((r) => r.userId));
  return members.map((m) => {
    const role = m.user.id === cause.leaderId ? "leads" : leadsCause(cause, m.user.id) ? "co-leads" : null;
    return {
      id: m.user.id,
      name: m.user.name,
      joinedAt: m.createdAt.toISOString(),
      signed: signedIds.has(m.user.id),
      going: goingIds.has(m.user.id),
      from: fromLabel(m.source, m.invitedById, viewerId),
      role,
      hidden: !m.user.showName && !role,
    };
  });
}
