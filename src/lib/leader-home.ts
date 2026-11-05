import "server-only";
import { db } from "./db";
import { displayName } from "./accounts";
import { isActive } from "./stages";
import { HOSTING_SOON_DAYS, NEW_MEMBER_DAYS, needsYou, type NeedsInput } from "./needs-you";

// A leader's home on /me (#75): the causes they lead and what needs them.

const DAY = 24 * 60 * 60 * 1000;

export async function getLeaderHome(userId: string, now = new Date()) {
  const led = await db.cause.findMany({
    where: { removedAt: null, OR: [{ leaderId: userId }, { coLeaders: { some: { userId, acceptedAt: { not: null } } } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, placeName: true, stage: true, quietAskedAt: true, leaderId: true, hidden: true, _count: { select: { members: true } } },
  });
  const ledIds = led.map((c) => c.id);
  const activeIds = led.filter((c) => isActive(c.stage)).map((c) => c.id);

  const [mine, offers, invites, wins, hosting, causeReports, commentReports] = await Promise.all([
    db.causeMember.findMany({ where: { userId, causeId: { in: activeIds } }, select: { causeId: true, lastLookedAt: true } }),
    db.leadOffer.findMany({
      where: { toUserId: userId, answeredAt: null, cause: { removedAt: null } },
      select: { causeId: true, createdAt: true, answeredAt: true, cause: { select: { title: true } }, from: { select: { name: true, deactivatedAt: true } } },
    }),
    db.coLeader.findMany({
      where: { userId, acceptedAt: null, cause: { removedAt: null } },
      select: { causeId: true, createdAt: true, acceptedAt: true, cause: { select: { title: true } }, invitedBy: { select: { name: true, deactivatedAt: true } } },
    }),
    db.winProposal.findMany({
      where: { resolvedAt: null, cause: { removedAt: null, members: { some: { userId } } } },
      select: {
        causeId: true,
        createdAt: true,
        resolvedAt: true,
        proposedById: true,
        proposedBy: { select: { name: true, deactivatedAt: true } },
        confirmations: { select: { userId: true } },
        cause: { select: { title: true, _count: { select: { members: true } } } },
      },
    }),
    db.meetup.findMany({
      where: { organizerId: userId, startsAt: { gte: now, lt: new Date(now.getTime() + HOSTING_SOON_DAYS * DAY) }, cause: { removedAt: null } },
      select: { id: true, title: true, startsAt: true },
    }),
    ledIds.length
      ? db.report.groupBy({ by: ["targetId"], where: { resolved: false, targetType: "cause", targetId: { in: ledIds } }, _count: { _all: true } })
      : Promise.resolve([]),
    ledIds.length ? db.report.findMany({ where: { resolved: false, targetType: "comment" }, select: { targetId: true } }) : Promise.resolve([]),
  ]);

  // Reports on chat messages, counted by the cause they're in.
  const reportedComments = commentReports.length
    ? await db.comment.findMany({ where: { id: { in: commentReports.map((r) => r.targetId) }, causeId: { in: ledIds } }, select: { id: true, causeId: true } })
    : [];
  const reportCounts = new Map<string, number>();
  for (const r of causeReports) reportCounts.set(r.targetId, (reportCounts.get(r.targetId) ?? 0) + r._count._all);
  const commentCause = new Map(reportedComments.map((c) => [c.id, c.causeId]));
  for (const r of commentReports) {
    const causeId = commentCause.get(r.targetId);
    if (causeId) reportCounts.set(causeId, (reportCounts.get(causeId) ?? 0) + 1);
  }

  // New members since they last opened each active cause (the last week, the first time).
  const lastLooked = new Map(mine.map((m) => [m.causeId, m.lastLookedAt]));
  const newMembers = new Map(
    await Promise.all(
      activeIds.map(async (id) => {
        const since = lastLooked.get(id) ?? new Date(now.getTime() - NEW_MEMBER_DAYS * DAY);
        return [id, await db.causeMember.count({ where: { causeId: id, userId: { not: userId }, createdAt: { gt: since } } })] as const;
      }),
    ),
  );

  const titles = new Map(led.map((c) => [c.id, c.title]));
  const input: NeedsInput = {
    leadOffers: offers.map((o) => ({ causeId: o.causeId, causeTitle: o.cause.title, fromName: displayName(o.from), createdAt: o.createdAt, answeredAt: o.answeredAt })),
    coLeadInvites: invites.map((c) => ({ causeId: c.causeId, causeTitle: c.cause.title, inviterName: displayName(c.invitedBy), createdAt: c.createdAt, acceptedAt: c.acceptedAt })),
    wins: wins.map((w) => ({
      causeId: w.causeId,
      causeTitle: w.cause.title,
      proposerName: displayName(w.proposedBy),
      proposedByMe: w.proposedById === userId,
      confirmedByMe: w.confirmations.some((c) => c.userId === userId),
      confirmed: w.confirmations.length,
      members: w.cause._count.members,
      createdAt: w.createdAt,
      resolvedAt: w.resolvedAt,
    })),
    led: led.map((c) => ({ id: c.id, title: c.title, stage: c.stage, quietAskedAt: c.quietAskedAt, newMembers: newMembers.get(c.id) ?? 0 })),
    hosting,
    reports: [...reportCounts].map(([causeId, count]) => ({ causeId, causeTitle: titles.get(causeId) ?? "your cause", count })),
  };

  return {
    led: led.map((c) => ({ ...c, coLeading: c.leaderId !== userId, members: c._count.members })),
    needs: needsYou(input, now.getTime()),
  };
}
