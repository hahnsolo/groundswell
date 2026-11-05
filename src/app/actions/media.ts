"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canRemoveCover, clearCover } from "@/lib/covers";

/** Removes a cover image: the people who can change it, or an admin or moderator. */
export async function removeCover(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ target: z.enum(["cause", "event"]), id: z.string().min(1).max(40) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  if (!(await canRemoveCover(parsed.data.target, parsed.data.id, user))) return;
  await clearCover(parsed.data.target, parsed.data.id);
  refresh();
}
