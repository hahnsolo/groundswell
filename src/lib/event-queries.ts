import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "./db";
import { boundingBox, distanceKm } from "./geo";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Events stay listed until a few hours after they start, in case people are running late. */
export const STILL_ON_HOURS = 6;
/** How far ahead "Events nearby" looks. */
export const EVENTS_AHEAD_DAYS = 60;

const person = { select: { id: true, name: true, deactivatedAt: true } } as const;

/** One event and its cause, for /events/[id]. Cached per request. */
export const getEventDetail = cache(async (id: string, viewerId: string | null) => {
  await connection();
  const event = await db.meetup.findUnique({
    where: { id },
    include: {
      organizer: person,
      issue: {
        select: {
          id: true,
          title: true,
          authorId: true,
          hidden: true,
          removedAt: true,
          placeName: true,
          region: true,
          country: true,
          postalCode: true,
        },
      },
      _count: { select: { rsvps: true } },
      // The first few people going, for "Priya, Sam and 12 neighbours are going".
      rsvps: { orderBy: { createdAt: "asc" }, take: 4, select: { userId: true, user: { select: { name: true, deactivatedAt: true } } } },
    },
  });
  if (!event) return null;
  const viewerGoing = viewerId
    ? !!(await db.rsvp.findUnique({ where: { meetupId_userId: { meetupId: id, userId: viewerId } }, select: { userId: true } }))
    : false;
  const now = Date.now();
  const { rsvps, ...rest } = event;
  return {
    ...rest,
    goingNames: rsvps.filter((r) => !r.user.deactivatedAt).map((r) => r.user.name),
    viewerGoing,
    upcoming: event.startsAt.getTime() > now,
    over: event.startsAt.getTime() < now - STILL_ON_HOURS * HOUR,
  };
});

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/** Upcoming events for causes near a place, soonest first. */
export async function getNearbyEvents(opts: { country: string; lat: number; lng: number; radiusKm: number }, viewerId: string | null) {
  await connection();
  const now = Date.now();
  const box = boundingBox(opts.lat, opts.lng, opts.radiusKm);
  const rows = await db.meetup.findMany({
    where: {
      startsAt: { gte: new Date(now - STILL_ON_HOURS * HOUR), lt: new Date(now + EVENTS_AHEAD_DAYS * DAY) },
      issue: {
        country: opts.country,
        hidden: false,
        removedAt: null,
        lat: { gte: box.minLat, lte: box.maxLat },
        lng: { gte: box.minLng, lte: box.maxLng },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      issue: { select: { id: true, title: true, category: true, placeName: true, lat: true, lng: true } },
      _count: { select: { rsvps: true } },
      rsvps: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : false,
    },
  });
  return rows
    .map((e) => ({
      ...e,
      distanceKm: distanceKm(opts.lat, opts.lng, e.issue.lat, e.issue.lng),
      viewerGoing: Array.isArray(e.rsvps) && e.rsvps.length > 0,
      thisWeek: e.startsAt.getTime() < now + 7 * DAY,
    }))
    .filter((e) => e.distanceKm <= opts.radiusKm);
}

export type NearbyEvent = Awaited<ReturnType<typeof getNearbyEvents>>[number];
