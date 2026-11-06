"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { announcementsLeft, MAX_ANNOUNCEMENT_LENGTH, MAX_ANNOUNCEMENTS_PER_WEEK, weekAgo } from "@/lib/announcements";
import { db } from "@/lib/db";
import { fromZodError, type FormState } from "@/lib/forms";
import { leadsCause } from "@/lib/leadership";
import { announceChatChange } from "@/lib/live-chat";
import { notifyAnnouncement } from "@/lib/notify";
import { honeypotTripped, linkError } from "@/lib/spam";
import { isActive } from "@/lib/stages";

// Announcements to all members (#73).

const id = z.string().min(1).max(40);
const LEADERS = { leaderId: true, coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } } } as const;

/** Post news: pinned at the top of the chat (replacing the last one), and members are told. */
export async function postAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, body: z.string().trim().min(5, "Say a little more (5+ characters).").max(MAX_ANNOUNCEMENT_LENGTH) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { causeId, body } = parsed.data;
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { ...LEADERS, stage: true, removedAt: true, hidden: true } });
  if (!cause || cause.removedAt || !isActive(cause.stage) || !leadsCause(cause, user.id)) return { error: "Only the people leading this cause can post an announcement." };
  if (cause.hidden) return { error: "This cause is hidden while moderators review it, so it can't post announcements." };
  if (honeypotTripped(formData)) return { error: "Something went wrong. Please try again." };
  const links = linkError(user, body);
  if (links) return { error: links };
  const postedThisWeek = await db.announcement.count({ where: { causeId, createdAt: { gte: weekAgo() } } });
  if (announcementsLeft(postedThisWeek) === 0) return { error: `A cause can post ${MAX_ANNOUNCEMENTS_PER_WEEK} announcements a week, so they never feel spammy. Try again in a few days, or post in the chat.` };

  const [, announcement] = await db.$transaction([
    db.announcement.updateMany({ where: { causeId, unpinnedAt: null }, data: { unpinnedAt: new Date() } }),
    db.announcement.create({ data: { causeId, authorId: user.id, body } }),
  ]);
  // In moderators' log, so they can see and remove it without waiting for a report.
  await db.leaderAction.create({ data: { kind: "announce", causeId, byUserId: user.id, targetUserId: user.id, commentId: announcement.id, reason: body.slice(0, 300) } });
  announceChatChange(causeId);
  after(() => notifyAnnouncement(announcement.id).catch((e) => console.warn("Announcement notices failed:", (e as Error).message)));
  refresh();
  return { ok: true };
}

export async function unpinAnnouncement(formData: FormData) {
  const user = await requireUser();
  const announcementId = id.parse(formData.get("announcementId"));
  const a = await db.announcement.findUnique({ where: { id: announcementId }, select: { causeId: true, cause: { select: LEADERS } } });
  if (!a || !leadsCause(a.cause, user.id)) return;
  await db.announcement.update({ where: { id: announcementId }, data: { unpinnedAt: new Date() } });
  announceChatChange(a.causeId);
  refresh();
}
