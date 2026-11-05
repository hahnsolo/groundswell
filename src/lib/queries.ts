import "server-only";
import { db } from "./db";
import { cache } from "react";
import { after, connection } from "next/server";
import { advance, confirmationsNeeded, proposalOpen, type Stage } from "./stages";
import { boundingBox, distanceKm } from "./geo";
import { isRecentWin } from "./momentum";
import { countActive } from "./leading-limit";

export type CauseSort = "top" | "new";

export async function getNearbyCauses(opts: {
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  sort: CauseSort;
}) {
  await connection(); // uses the current time, so it's always worked out per request
  const now = new Date();
  const box = boundingBox(opts.lat, opts.lng, opts.radiusKm);
  const rows = await db.cause.findMany({
    where: {
      country: opts.country,
      hidden: false,
      // Closed causes leave the board; won ones stay so the wins strip can show them.
      stage: { not: "closed" },
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
      ...(opts.category ? { category: opts.category } : {}),
    },
    include: {
      _count: { select: { members: true, comments: true, meetups: true } },
      // The first few people to care, for "Priya, Sam and 12 neighbours care".
      members: {
        orderBy: { createdAt: "asc" },
        take: 4,
        select: { user: { select: { name: true, deactivatedAt: true } } },
      },
      meetups: { where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, title: true } },
      campaigns: { orderBy: { createdAt: "desc" }, take: 1, select: { goal: true, _count: { select: { signatures: true } } } },
    },
    take: 500,
  });

  // New members this week, per cause, in one query.
  const weekly = await db.causeMember.groupBy({
    by: ["causeId"],
    where: { causeId: { in: rows.map((r) => r.id) }, createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
    _count: { _all: true },
  });
  const joinedThisWeek = new Map(weekly.map((w) => [w.causeId, w._count._all]));

  return rows
    .map(({ members, meetups, campaigns, ...cause }) => ({
      ...cause,
      distanceKm: distanceKm(opts.lat, opts.lng, cause.lat, cause.lng),
      memberNames: members.filter((s) => !s.user.deactivatedAt).map((s) => s.user.name),
      nextMeetup: meetups[0] ?? null,
      campaign: campaigns[0] ? { signed: campaigns[0]._count.signatures, goal: campaigns[0].goal } : null,
      joinedThisWeek: joinedThisWeek.get(cause.id) ?? 0,
    }))
    .filter((cause) => cause.distanceKm <= opts.radiusKm)
    .sort((a, b) =>
      opts.sort === "new"
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : // Won causes sink; otherwise most-supported first.
          Number(a.stage === "won") - Number(b.stage === "won") ||
          b._count.members - a._count.members ||
          b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

export type NearbyCause = Awaited<ReturnType<typeof getNearbyCauses>>[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The headline numbers for a neighbourhood: people involved, events this week, recent wins. */
export async function getAreaPulse(causes: NearbyCause[]) {
  await connection();
  const now = new Date();
  const ids = causes.map((i) => i.id);
  const [people, eventsThisWeek] = await Promise.all([
    db.causeMember.findMany({
      where: { causeId: { in: ids }, user: { deactivatedAt: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.meetup.count({ where: { causeId: { in: ids }, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY_MS) } } }),
  ]);
  const wins = causes
    .filter((i) => isRecentWin(i.resolvedAt, now))
    .sort((a, b) => b.resolvedAt!.getTime() - a.resolvedAt!.getTime());
  return { people: people.length, eventsThisWeek, wins };
}

/**
 * Everything on a cause's pages. Cached per request, so the shared header and
 * the About/Chat/Events tab underneath read the database once between them.
 */
export const getCauseDetail = cache(async (id: string, viewerId: string | null) => {
  await connection(); // uses the current time, so it's always worked out per request
  const cause = await db.cause.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, deactivatedAt: true } },
      leader: { select: { id: true, name: true, deactivatedAt: true } },
      // The latest unanswered handover offer, if any (it lapses after 7 days; see src/lib/leadership.ts).
      leadOffers: {
        where: { answeredAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { to: { select: { id: true, name: true } }, from: { select: { id: true, name: true } } },
      },
      // Co-leaders and open invites (#42), oldest first.
      coLeaders: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, deactivatedAt: true } } } },
      _count: { select: { members: true, comments: { where: { hidden: false } } } },
      members: {
        orderBy: { createdAt: "asc" },
        take: 4,
        select: { user: { select: { name: true, deactivatedAt: true } } },
      },
      comments: {
        // Authors still see their own hidden or removed comments, with a note.
        where: viewerId ? { OR: [{ hidden: false }, { authorId: viewerId }] } : { hidden: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, deactivatedAt: true } } },
      },
      meetups: {
        where: { endsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        include: {
          organizer: { select: { id: true, name: true, deactivatedAt: true } },
          _count: { select: { rsvps: true } },
          rsvps: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : false,
        },
      },
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: {
          creator: { select: { id: true, name: true, deactivatedAt: true } },
          _count: { select: { signatures: true } },
          signatures: {
            orderBy: { createdAt: "desc" },
            take: 5,
            where: { note: { not: null } },
            include: { user: { select: { name: true, deactivatedAt: true } } },
          },
        },
      },
      // The leader's latest "it's fixed" waiting for members to confirm (#24).
      winProposals: {
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { proposedBy: { select: { id: true, name: true } }, confirmations: { select: { userId: true } } },
      },
      // The timeline: contacts, replies, check-ins.
      actions: { orderBy: { happenedAt: "desc" }, take: 50, include: { createdBy: { select: { name: true, deactivatedAt: true } } } },
    },
  });
  if (!cause) return null;

  // Stages move forward on their own; some milestones (an event starting) just happen with time.
  const firstEvent = await db.meetup.findFirst({ where: { causeId: id, startsAt: { lte: new Date() } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, title: true } });
  const stage = advance(cause.stage as Stage, {
    members: cause._count.members,
    heldEvent: !!firstEvent,
    tookAction: cause.campaigns.length > 0 || cause.actions.some((a) => a.kind === "contacted"),
  });
  if (stage !== cause.stage) after(() => db.cause.updateMany({ where: { id, stage: cause.stage }, data: { stage } }));

  const [supported, signedIds] = viewerId
    ? await Promise.all([
        db.causeMember.findUnique({ where: { causeId_userId: { causeId: id, userId: viewerId } } }),
        db.signature.findMany({
          where: { userId: viewerId, campaign: { causeId: id } },
          select: { campaignId: true },
        }),
      ])
    : [null, []];

  const now = Date.now();
  const { members, winProposals, ...rest } = cause;
  const proposal = winProposals[0] && proposalOpen(winProposals[0]) ? winProposals[0] : null;
  return {
    ...rest,
    stage,
    firstEvent,
    winProposal: proposal
      ? {
          ...proposal,
          confirmed: proposal.confirmations.length,
          needed: confirmationsNeeded(cause._count.members),
          viewerConfirmed: !!viewerId && proposal.confirmations.some((c) => c.userId === viewerId),
        }
      : null,
    memberNames: members.filter((s) => !s.user.deactivatedAt).map((s) => s.user.name),
    // The list includes meetups that are on right now; only ones still to come can change host.
    meetups: cause.meetups.map((m) => ({ ...m, upcoming: m.startsAt.getTime() > now })),
    viewerIsMember: !!supported,
    // When the viewer joined (clicked "Join"): starts the chat's 24-hour wait.
    viewerJoinedAt: supported?.createdAt ?? null,
    viewerSigned: new Set(signedIds.map((s) => s.campaignId)),
  };
});

export type CauseDetail = NonNullable<Awaited<ReturnType<typeof getCauseDetail>>>;

/** The active causes someone leads or co-leads, oldest first: what counts toward MAX_LEADING_CAUSES. */
export async function getActiveLedCauses(userId: string) {
  const led = await db.cause.findMany({
    where: { removedAt: null, OR: [{ leaderId: userId }, { coLeaders: { some: { userId, acceptedAt: { not: null } } } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, stage: true, removedAt: true },
  });
  return led.filter((c) => countActive([c]) === 1);
}
