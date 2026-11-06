"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { unsubscribe } from "@/lib/notify";
import { NOTIFY_KIND_IDS, NOTIFY_KINDS } from "@/lib/notify-rules";
import type { FormState } from "@/lib/forms";

/** The unsubscribe page's button: works without signing in, using the signed link. */
export async function unsubscribeFromLink(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  const ok = await unsubscribe(get("u"), get("k"), get("t"));
  redirect(`/unsubscribe?k=${encodeURIComponent(get("k"))}&done=${ok ? 1 : 0}`);
}

/** The email settings on /me: one checkbox per kind (unticked boxes aren't sent, so absent means off). */
export async function saveEmailPrefs(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const data = Object.fromEntries(NOTIFY_KIND_IDS.map((k) => [NOTIFY_KINDS[k].pref, formData.get(NOTIFY_KINDS[k].pref) === "on"]));
  await db.user.update({ where: { id: user.id }, data });
  refresh();
  return { ok: true };
}

/** Opening your notifications marks them read (#95). */
export async function markNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

/** Mute (or unmute) notifications about one cause. */
export async function setCauseMuted(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ causeId: z.string().min(1).max(40), muted: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.causeMember.updateMany({ where: { causeId: parsed.data.causeId, userId: user.id }, data: { muted: parsed.data.muted === "1" } });
  refresh();
}
