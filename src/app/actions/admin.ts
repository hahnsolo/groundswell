"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const decisionSchema = z.object({
  targetType: z.enum(["issue", "comment"]),
  targetId: z.string().min(1).max(40),
  decision: z.enum(["kept", "removed"]),
});

/** Resolve every open report on a piece of content: restore it, or delete it. */
export async function moderate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId, decision } = parsed.data;

  await db.$transaction(async (tx) => {
    if (decision === "kept") {
      if (targetType === "issue") await tx.issue.updateMany({ where: { id: targetId }, data: { hidden: false } });
      else await tx.comment.updateMany({ where: { id: targetId }, data: { hidden: false } });
    } else {
      if (targetType === "issue") await tx.issue.deleteMany({ where: { id: targetId } });
      else await tx.comment.deleteMany({ where: { id: targetId } });
    }
    await tx.report.updateMany({
      where: { targetType, targetId, resolved: false },
      data: { resolved: true, resolution: decision, resolvedById: admin.id, resolvedAt: new Date() },
    });
  });
  refresh();
}
