"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromZodError, type FormState } from "@/lib/forms";
import { canHideMessage, HIDE_REPORT_REASON, removeProblem } from "@/lib/leader-moderation";
import { leadsCause } from "@/lib/leadership";
import { leaveCause } from "@/lib/leaving";
import { announceChatChange } from "@/lib/live-chat";
import { appUrl, sendEmail } from "@/lib/mail";

// Leaders keeping their own cause's chat clean (#71), and moderators' undo.
// Every step is written to LeaderAction, which moderators see in the queue.

const id = z.string().min(1).max(40);
const LEADERS = { leaderId: true, coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } } } as const;

/** Hide a message: others see a placeholder, its author still sees it, and moderators get a report. */
export async function hideMessage(formData: FormData) {
  const user = await requireUser();
  const commentId = id.parse(formData.get("commentId"));
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { causeId: true, removedAt: true, author: { select: { id: true, isAdmin: true } }, cause: { select: LEADERS } },
  });
  if (!comment || comment.removedAt) return;
  if (!canHideMessage({ id: user.id, leads: leadsCause(comment.cause, user.id) }, comment.author)) return;
  await db.$transaction([
    db.comment.update({ where: { id: commentId }, data: { hidden: true, hiddenByLeaderId: user.id } }),
    db.report.upsert({
      where: { targetType_targetId_reporterId: { targetType: "comment", targetId: commentId, reporterId: user.id } },
      create: { targetType: "comment", targetId: commentId, reason: HIDE_REPORT_REASON, reporterId: user.id },
      update: { resolved: false, resolution: null, resolvedById: null, resolvedAt: null, reason: HIDE_REPORT_REASON },
    }),
    db.leaderAction.create({ data: { kind: "hide", causeId: comment.causeId, byUserId: user.id, targetUserId: comment.author.id, commentId } }),
  ]);
  announceChatChange(comment.causeId);
  refresh();
}

/** Changed their mind: un-hide it, and withdraw the report it filed. */
export async function unhideMessage(formData: FormData) {
  const user = await requireUser();
  const commentId = id.parse(formData.get("commentId"));
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { causeId: true, removedAt: true, hiddenByLeaderId: true, authorId: true, cause: { select: LEADERS } },
  });
  if (!comment || comment.removedAt || !comment.hiddenByLeaderId || !leadsCause(comment.cause, user.id)) return;
  await db.$transaction([
    db.comment.update({ where: { id: commentId }, data: { hidden: false, hiddenByLeaderId: null } }),
    db.report.updateMany({
      where: { targetType: "comment", targetId: commentId, reporterId: comment.hiddenByLeaderId, resolved: false },
      data: { resolved: true, resolution: "kept", resolvedById: user.id, resolvedAt: new Date() },
    }),
    db.leaderAction.create({ data: { kind: "unhide", causeId: comment.causeId, byUserId: user.id, targetUserId: comment.authorId, commentId } }),
  ]);
  announceChatChange(comment.causeId);
  refresh();
}

/** Remove someone from the cause: they leave it, can't rejoin, and are told why. */
export async function removeFromCause(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, userId: id, reason: z.string().trim().min(3, "Say why, in a plain sentence. They'll see it.").max(300) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { causeId, userId, reason } = parsed.data;
  const [cause, target] = await Promise.all([
    db.cause.findUnique({ where: { id: causeId }, select: { ...LEADERS, title: true } }),
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, isAdmin: true, deactivatedAt: true } }),
  ]);
  if (!cause || !target) return { error: "That person or cause no longer exists." };
  const problem = removeProblem(
    { id: user.id, leads: leadsCause(cause, user.id) },
    { id: userId, isAdmin: target.isAdmin, isLeader: cause.leaderId === userId, isCoLeader: cause.coLeaders.some((c) => c.userId === userId && c.acceptedAt) },
  );
  if (problem) return { error: problem };

  await leaveCause(userId, causeId);
  await db.$transaction([
    db.causeBan.upsert({
      where: { causeId_userId: { causeId, userId } },
      create: { causeId, userId, byUserId: user.id, reason },
      update: { byUserId: user.id, reason, liftedAt: null, createdAt: new Date() },
    }),
    // An offer to lead that's still open goes with them.
    db.leadOffer.updateMany({ where: { causeId, toUserId: userId, answeredAt: null }, data: { answeredAt: new Date(), accepted: false } }),
    db.leaderAction.create({ data: { kind: "remove", causeId, byUserId: user.id, targetUserId: userId, reason } }),
  ]);
  announceChatChange(causeId);
  if (!target.deactivatedAt) {
    after(() =>
      sendEmail({
        to: target.email,
        subject: `You were removed from "${cause.title}"`,
        text: `Hi ${target.name},\n\nThe people leading "${cause.title}" on Groundswell removed you from it. They said:\n\n"${reason}"\n\nYou can't rejoin this cause. If you think this is wrong, you can report the cause from its page:\n${appUrl(`/causes/${causeId}`)}`,
      }).catch((e) => console.warn("Removal email failed:", (e as Error).message)),
    );
  }
  refresh();
  return { ok: true };
}

/** Moderators: undo a leader's hide. */
export async function undoLeaderHide(formData: FormData) {
  const admin = await requireAdmin();
  const commentId = id.parse(formData.get("commentId"));
  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { causeId: true, authorId: true, hiddenByLeaderId: true, removedAt: true } });
  if (!comment?.hiddenByLeaderId || comment.removedAt) return;
  await db.$transaction([
    db.comment.update({ where: { id: commentId }, data: { hidden: false, hiddenByLeaderId: null } }),
    db.report.updateMany({
      where: { targetType: "comment", targetId: commentId, reporterId: comment.hiddenByLeaderId, resolved: false },
      data: { resolved: true, resolution: "kept", resolvedById: admin.id, resolvedAt: new Date() },
    }),
    db.leaderAction.create({ data: { kind: "undo_hide", causeId: comment.causeId, byUserId: admin.id, targetUserId: comment.authorId, commentId } }),
  ]);
  announceChatChange(comment.causeId);
  refresh();
}

/** Moderators: undo a removal, so the person can join again. (Their membership doesn't come back by itself.) */
export async function liftCauseBan(formData: FormData) {
  const admin = await requireAdmin();
  const causeId = id.parse(formData.get("causeId"));
  const userId = id.parse(formData.get("userId"));
  const { count } = await db.causeBan.updateMany({ where: { causeId, userId, liftedAt: null }, data: { liftedAt: new Date() } });
  if (count) await db.leaderAction.create({ data: { kind: "lift_ban", causeId, byUserId: admin.id, targetUserId: userId } });
  refresh();
}
