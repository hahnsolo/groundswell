"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { cleanRemovalReason, purgeCutoff } from "@/lib/moderation";
import { announceChatChange } from "@/lib/live-chat";

/** Open chats showing this content should update. Returns the cause it belongs to. */
async function causeOf(targetType: "issue" | "comment", targetId: string) {
  if (targetType === "issue") return targetId;
  const comment = await db.comment.findUnique({ where: { id: targetId }, select: { issueId: true } });
  return comment?.issueId ?? null;
}

const targetSchema = z.object({
  targetType: z.enum(["issue", "comment"]),
  targetId: z.string().min(1).max(40),
});

const decisionSchema = targetSchema.extend({
  decision: z.enum(["kept", "removed"]),
});

/**
 * Resolve every open report on a piece of content: restore it, or remove it.
 * Removing doesn't delete: the content is hidden from everyone but its author
 * and deleted for good by the daily purge a week later, so mistakes can be undone.
 */
export async function moderate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId, decision } = parsed.data;
  const where = { id: targetId, removedAt: null };
  const data =
    decision === "kept"
      ? { hidden: false }
      : { hidden: true, removedAt: new Date(), removedById: admin.id, removalReason: cleanRemovalReason(formData.get("reason")) };

  await db.$transaction(async (tx) => {
    if (targetType === "issue") await tx.issue.updateMany({ where, data });
    else await tx.comment.updateMany({ where, data });
    await tx.report.updateMany({
      where: { targetType, targetId, resolved: false },
      data: { resolved: true, resolution: decision, resolvedById: admin.id, resolvedAt: new Date() },
    });
  });
  const cause = await causeOf(targetType, targetId);
  if (cause) announceChatChange(cause);
  refresh();
}

/** Undo a removal that hasn't been purged yet. */
export async function restore(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId } = parsed.data;
  const where = { id: targetId, removedAt: { gt: purgeCutoff() } };
  const data = { hidden: false, removedAt: null, removedById: null, removalReason: null };

  await db.$transaction(async (tx) => {
    const { count } =
      targetType === "issue" ? await tx.issue.updateMany({ where, data }) : await tx.comment.updateMany({ where, data });
    if (count === 0) return;
    // Record the reversal on the reports that led to the removal.
    await tx.report.updateMany({
      where: { targetType, targetId, resolution: "removed" },
      data: { resolution: "restored", resolvedById: admin.id, resolvedAt: new Date() },
    });
  });
  const cause = await causeOf(targetType, targetId);
  if (cause) announceChatChange(cause);
  refresh();
}
