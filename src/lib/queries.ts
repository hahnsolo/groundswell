import "server-only";
import { db } from "./db";
import { cache } from "react";
import { connection } from "next/server";
import { boundingBox, distanceKm } from "./geo";
import { isRecentWin } from "./momentum";

export type IssueSort = "top" | "new";

export async function getNearbyIssues(opts: {
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  sort: IssueSort;
}) {
  await connection(); // uses the current time, so it's always worked out per request
  const now = new Date();
  const box = boundingBox(opts.lat, opts.lng, opts.radiusKm);
  const rows = await db.issue.findMany({
    where: {
      country: opts.country,
      hidden: false,
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
      ...(opts.category ? { category: opts.category } : {}),
    },
    include: {
      _count: { select: { supports: true, comments: true, meetups: true } },
      // The first few people to care, for "Priya, Sam and 12 neighbours care".
      supports: {
        orderBy: { createdAt: "asc" },
        take: 4,
        select: { user: { select: { name: true, deactivatedAt: true } } },
      },
      meetups: { where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, title: true } },
      campaigns: { orderBy: { createdAt: "desc" }, take: 1, select: { goal: true, _count: { select: { signatures: true } } } },
    },
    take: 500,
  });

  // New supporters this week, per cause, in one query.
  const weekly = await db.issueSupport.groupBy({
    by: ["issueId"],
    where: { issueId: { in: rows.map((r) => r.id) }, createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
    _count: { _all: true },
  });
  const joinedThisWeek = new Map(weekly.map((w) => [w.issueId, w._count._all]));

  return rows
    .map(({ supports, meetups, campaigns, ...issue }) => ({
      ...issue,
      distanceKm: distanceKm(opts.lat, opts.lng, issue.lat, issue.lng),
      supporterNames: supports.filter((s) => !s.user.deactivatedAt).map((s) => s.user.name),
      nextMeetup: meetups[0] ?? null,
      campaign: campaigns[0] ? { signed: campaigns[0]._count.signatures, goal: campaigns[0].goal } : null,
      joinedThisWeek: joinedThisWeek.get(issue.id) ?? 0,
    }))
    .filter((issue) => issue.distanceKm <= opts.radiusKm)
    .sort((a, b) =>
      opts.sort === "new"
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : // Resolved issues sink; otherwise most-supported first.
          Number(a.status === "resolved") - Number(b.status === "resolved") ||
          b._count.supports - a._count.supports ||
          b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

export type NearbyIssue = Awaited<ReturnType<typeof getNearbyIssues>>[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The headline numbers for a neighbourhood: people involved, events this week, recent wins. */
export async function getAreaPulse(issues: NearbyIssue[]) {
  await connection();
  const now = new Date();
  const ids = issues.map((i) => i.id);
  const [people, eventsThisWeek] = await Promise.all([
    db.issueSupport.findMany({
      where: { issueId: { in: ids }, user: { deactivatedAt: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.meetup.count({ where: { issueId: { in: ids }, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY_MS) } } }),
  ]);
  const wins = issues
    .filter((i) => isRecentWin(i.resolvedAt, now))
    .sort((a, b) => b.resolvedAt!.getTime() - a.resolvedAt!.getTime());
  return { people: people.length, eventsThisWeek, wins };
}

/**
 * Everything on a cause's pages. Cached per request, so the shared header and
 * the About/Chat/Events tab underneath read the database once between them.
 */
export const getIssueDetail = cache(async (id: string, viewerId: string | null) => {
  await connection(); // uses the current time, so it's always worked out per request
  const issue = await db.issue.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, deactivatedAt: true } },
      _count: { select: { supports: true, comments: { where: { hidden: false } } } },
      supports: {
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
        where: { startsAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
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
    },
  });
  if (!issue) return null;

  const [supported, signedIds] = viewerId
    ? await Promise.all([
        db.issueSupport.findUnique({ where: { issueId_userId: { issueId: id, userId: viewerId } } }),
        db.signature.findMany({
          where: { userId: viewerId, campaign: { issueId: id } },
          select: { campaignId: true },
        }),
      ])
    : [null, []];

  const now = Date.now();
  const { supports, ...rest } = issue;
  return {
    ...rest,
    supporterNames: supports.filter((s) => !s.user.deactivatedAt).map((s) => s.user.name),
    // The list includes meetups that started in the last few hours; only ones still to come can change host.
    meetups: issue.meetups.map((m) => ({ ...m, upcoming: m.startsAt.getTime() > now })),
    viewerSupports: !!supported,
    // When the viewer joined (clicked "Join"): starts the chat's 24-hour wait.
    viewerJoinedAt: supported?.createdAt ?? null,
    viewerSigned: new Set(signedIds.map((s) => s.campaignId)),
  };
});

export type IssueDetail = NonNullable<Awaited<ReturnType<typeof getIssueDetail>>>;
