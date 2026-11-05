import "server-only";
import { Prisma } from "@prisma/client";
import QRCode from "qrcode";
import { db } from "./db";
import { displayName } from "./accounts";
import { clip, firstName, flyerWhen } from "./share-meta";
import { STAGE_LABELS, type Stage } from "./stages";
import { isShortCode, makeShortCode, sourceSummary } from "./sources";

// Spreading the word (#67): short links for flyers and posts, what a flyer
// says, QR codes, and where people came from. QR codes are made here, in our
// own code (the qrcode library), never by an outside service.

export type SpreadKind = "cause" | "event";

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** The cause's or event's short code, made the first time it's asked for. */
export async function ensureShortCode(kind: SpreadKind, id: string): Promise<string | null> {
  const row = kind === "cause" ? await db.cause.findUnique({ where: { id }, select: { shortCode: true } }) : await db.meetup.findUnique({ where: { id }, select: { shortCode: true } });
  if (!row) return null;
  if (row.shortCode) return row.shortCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeShortCode();
    // Codes are shared between causes and events, so /go/<code> is never ambiguous.
    const taken = (await db.cause.count({ where: { shortCode: code } })) + (await db.meetup.count({ where: { shortCode: code } }));
    if (taken) continue;
    try {
      // Only set it if nobody else did in the meantime (two people opening the flyer at once).
      const where = { id, shortCode: null };
      const n = kind === "cause" ? await db.cause.updateMany({ where, data: { shortCode: code } }) : await db.meetup.updateMany({ where, data: { shortCode: code } });
      if (n.count === 1) return code;
      return ensureShortCode(kind, id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // taken just now: try another
      throw e;
    }
  }
  return null;
}

/** The page a short code points to, or null. */
export async function findShortCode(code: string): Promise<{ kind: SpreadKind; id: string } | null> {
  if (!isShortCode(code)) return null;
  const cause = await db.cause.findUnique({ where: { shortCode: code }, select: { id: true } });
  if (cause) return { kind: "cause", id: cause.id };
  const event = await db.meetup.findUnique({ where: { shortCode: code }, select: { id: true } });
  return event ? { kind: "event", id: event.id } : null;
}

export type Flyer = {
  kind: SpreadKind;
  id: string;
  path: string;
  title: string;
  /** Above the title: the place, or "Event · part of …". */
  kicker: string;
  /** The cause's one-line why. */
  why: string;
  day?: string;
  time?: string;
  where?: string;
  host?: string;
  /** For causes: the stage and how many have joined. */
  status?: string;
  coverUrl: string | null;
  coverAlt: string | null;
  causeId: string;
};

const whyLine = (description: string, ask: string | null | undefined) => clip(ask ? `The ask: ${ask}` : description, 150);

/** What a flyer or share image says. Null for hidden or removed causes (and their events). */
export async function getFlyer(kind: SpreadKind, id: string): Promise<Flyer | null> {
  if (kind === "cause") {
    const c = await db.cause.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        placeName: true,
        region: true,
        stage: true,
        hidden: true,
        removedAt: true,
        coverUrl: true,
        coverAlt: true,
        campaigns: { orderBy: { createdAt: "desc" }, take: 1, select: { ask: true } },
        _count: { select: { members: true } },
      },
    });
    if (!c || c.hidden || c.removedAt) return null;
    const n = c._count.members;
    return {
      kind,
      id,
      causeId: id,
      path: `/causes/${id}`,
      title: clip(c.title, 110),
      kicker: `${c.placeName}, ${c.region}`,
      why: whyLine(c.description, c.campaigns[0]?.ask),
      status: `${STAGE_LABELS[c.stage as Stage] ?? STAGE_LABELS.raised} · ${n === 1 ? "1 neighbour has" : `${n} neighbours have`} joined`,
      coverUrl: c.coverUrl,
      coverAlt: c.coverAlt,
    };
  }
  const e = await db.meetup.findUnique({
    where: { id },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isOnline: true,
      coverUrl: true,
      coverAlt: true,
      causeId: true,
      organizer: { select: { name: true, deactivatedAt: true } },
      cause: {
        select: {
          title: true,
          description: true,
          placeName: true,
          region: true,
          country: true,
          hidden: true,
          removedAt: true,
          coverUrl: true,
          coverAlt: true,
          campaigns: { orderBy: { createdAt: "desc" }, take: 1, select: { ask: true } },
        },
      },
    },
  });
  if (!e || e.cause.hidden || e.cause.removedAt) return null;
  const when = flyerWhen(e.startsAt, e.endsAt, e.cause.country, e.cause.region);
  return {
    kind,
    id,
    causeId: e.causeId,
    path: `/events/${id}`,
    title: clip(e.title, 110),
    kicker: `${e.cause.placeName} · ${clip(e.cause.title, 70)}`,
    why: whyLine(e.cause.description, e.cause.campaigns[0]?.ask),
    day: when.day,
    time: when.time,
    // Never the video link: that's only for people going.
    where: e.isOnline ? "Online (the link is shared when you RSVP)" : clip(e.location, 90),
    host: firstName(displayName(e.organizer)),
    coverUrl: e.coverUrl ?? e.cause.coverUrl,
    coverAlt: e.coverUrl ? e.coverAlt : e.cause.coverAlt,
  };
}

/** A QR code as SVG markup (dark on white, a quiet margin so phones read it from paper). */
export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#1f2a44", light: "#ffffff" } });
}

/** The same, as a data URL for share images. */
export async function qrDataUrl(url: string) {
  return `data:image/svg+xml;base64,${Buffer.from(await qrSvg(url)).toString("base64")}`;
}

/**
 * A leader's or co-leader's personal invite code for a cause (#68), made the
 * first time they open it. Null if they aren't a member.
 */
export async function ensureInviteCode(causeId: string, userId: string): Promise<string | null> {
  const key = { causeId_userId: { causeId, userId } };
  const row = await db.causeMember.findUnique({ where: key, select: { inviteCode: true } });
  if (!row) return null;
  if (row.inviteCode) return row.inviteCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Only if it's still unset (another tab may have just made one).
      await db.causeMember.updateMany({ where: { causeId, userId, inviteCode: null }, data: { inviteCode: makeShortCode() } });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // taken: try another
      throw e;
    }
  }
  return (await db.causeMember.findUnique({ where: key, select: { inviteCode: true } }))?.inviteCode ?? null;
}

/** Whose invite a code is, or null (#68). */
export async function findInviteCode(code: string) {
  if (!isShortCode(code)) return null;
  return db.causeMember.findUnique({ where: { inviteCode: code }, select: { causeId: true, userId: true } });
}

/** How many people joined a cause through this person's invite link (#68). */
export const joinedFromInvite = (causeId: string, userId: string) => db.causeMember.count({ where: { causeId, invitedById: userId } });

/** "9 people came from the flyer, 14 from WhatsApp" for the people leading it, or null. */
export async function causeSources(causeId: string) {
  const rows = await db.causeMember.groupBy({ by: ["source"], where: { causeId, source: { not: null } }, _count: { _all: true } });
  return sourceSummary(rows.map((r) => ({ source: r.source, count: r._count._all })));
}

export async function eventSources(meetupId: string) {
  const rows = await db.rsvp.groupBy({ by: ["source"], where: { meetupId, source: { not: null } }, _count: { _all: true } });
  return sourceSummary(rows.map((r) => ({ source: r.source, count: r._count._all })));
}
