import "server-only";
import { db } from "./db";
import { leadsCause } from "./leadership";
import { deleteImage, saveImage } from "./media-store";
import { imageType, storageState } from "./media-rules";

// Cover images for causes and events (#66).
// Causes: the people leading them. Events: the host, or the people leading
// its cause. Admins and moderators can remove any cover.

export type CoverTarget = "cause" | "event";

const LEADERS = { leaderId: true, coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } } } as const;

async function load(target: CoverTarget, id: string) {
  if (target === "cause") {
    const c = await db.cause.findUnique({ where: { id }, select: { ...LEADERS, removedAt: true, coverUrl: true } });
    return c && { removed: !!c.removedAt, editors: (userId: string) => leadsCause(c, userId), causeId: id };
  }
  const m = await db.meetup.findUnique({
    where: { id },
    select: { organizerId: true, causeId: true, cause: { select: { ...LEADERS, removedAt: true } } },
  });
  return m && { removed: !!m.cause.removedAt, editors: (userId: string) => m.organizerId === userId || leadsCause(m.cause, userId), causeId: m.causeId };
}

/** Whether this person can add or replace the cover. */
export async function canSetCover(target: CoverTarget, id: string, user: { id: string }) {
  const t = await load(target, id);
  return !!t && !t.removed && t.editors(user.id);
}

/** Whether this person can remove the cover (also admins, who moderate). */
export async function canRemoveCover(target: CoverTarget, id: string, user: { id: string; isAdmin?: boolean }) {
  const t = await load(target, id);
  return !!t && (!!user.isAdmin || (!t.removed && t.editors(user.id)));
}

export async function storageUsed() {
  const { _sum } = await db.mediaAsset.aggregate({ _sum: { bytes: true } });
  return _sum.bytes ?? 0;
}

export async function uploadsState() {
  return storageState(await storageUsed());
}

const field = (target: CoverTarget) => (target === "cause" ? "causeId" : "meetupId");

/** Saves both sizes, points the cause or event at them, and deletes the old ones. */
export async function setCover(target: CoverTarget, id: string, userId: string, full: Uint8Array, thumb: Uint8Array, alt: string) {
  const type = (b: Uint8Array) => imageType(b) ?? "image/webp"; // checked before we get here
  const [fullUrl, thumbUrl] = await Promise.all([saveImage(`${target}-${id}`, full, type(full)), saveImage(`${target}-${id}-thumb`, thumb, type(thumb))]);
  const link = { [field(target)]: id };
  const old = await db.mediaAsset.findMany({ where: link, select: { id: true, url: true } });
  await db.$transaction([
    db.mediaAsset.create({ data: { url: fullUrl, bytes: full.length, kind: "cover", uploadedById: userId, ...link } }),
    db.mediaAsset.create({ data: { url: thumbUrl, bytes: thumb.length, kind: "cover_thumb", uploadedById: userId, ...link } }),
    db.mediaAsset.updateMany({ where: { id: { in: old.map((o) => o.id) } }, data: { causeId: null, meetupId: null } }),
    target === "cause"
      ? db.cause.update({ where: { id }, data: { coverUrl: fullUrl, coverThumbUrl: thumbUrl, coverAlt: alt || null } })
      : db.meetup.update({ where: { id }, data: { coverUrl: fullUrl, coverThumbUrl: thumbUrl, coverAlt: alt || null } }),
  ]);
  await cleanupDetachedMedia();
  return fullUrl;
}

export async function clearCover(target: CoverTarget, id: string) {
  await db.$transaction([
    db.mediaAsset.updateMany({ where: { [field(target)]: id }, data: { causeId: null, meetupId: null } }),
    target === "cause"
      ? db.cause.update({ where: { id }, data: { coverUrl: null, coverThumbUrl: null, coverAlt: null } })
      : db.meetup.update({ where: { id }, data: { coverUrl: null, coverThumbUrl: null, coverAlt: null } }),
  ]);
  await cleanupDetachedMedia();
}

/**
 * Deletes files that no longer belong to anything: replaced or removed covers,
 * and covers of causes or events that were deleted (the daily job also runs this).
 */
export async function cleanupDetachedMedia() {
  const detached = await db.mediaAsset.findMany({ where: { causeId: null, meetupId: null }, select: { id: true, url: true }, take: 500 });
  for (const a of detached) {
    await deleteImage(a.url);
    await db.mediaAsset.delete({ where: { id: a.id } });
  }
  return detached.length;
}
