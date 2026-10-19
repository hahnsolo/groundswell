import "server-only";
import { db } from "./db";
import { boundingBox, distanceKm } from "./geo";

export type IssueSort = "top" | "new";

export async function getNearbyIssues(opts: {
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  sort: IssueSort;
}) {
  const box = boundingBox(opts.lat, opts.lng, opts.radiusKm);
  const rows = await db.issue.findMany({
    where: {
      country: opts.country,
      hidden: false,
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
      ...(opts.category ? { category: opts.category } : {}),
    },
    include: { _count: { select: { supports: true, comments: true, meetups: true } } },
    take: 500,
  });

  return rows
    .map((issue) => ({ ...issue, distanceKm: distanceKm(opts.lat, opts.lng, issue.lat, issue.lng) }))
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

export async function getIssueDetail(id: string, viewerId: string | null) {
  const issue = await db.issue.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, deactivatedAt: true } },
      _count: { select: { supports: true } },
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
  return {
    ...issue,
    // The list includes meetups that started in the last few hours; only ones still to come can change host.
    meetups: issue.meetups.map((m) => ({ ...m, upcoming: m.startsAt.getTime() > now })),
    viewerSupports: !!supported,
    viewerSigned: new Set(signedIds.map((s) => s.campaignId)),
  };
}
