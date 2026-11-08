import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/better-auth";
import { sendDelayedConfirmations } from "@/lib/confirm-email";
import { db } from "@/lib/db";
import { purgeCutoff } from "@/lib/moderation";
import { anonymizeExpiredAccounts } from "@/lib/leaving";
import { refreshStaleAreaReps } from "@/lib/area-reps";
import { dailyStageHousekeeping } from "@/lib/cause-stage";
import { pruneNotificationLog, sendChatDigests, sendEventReminders, sendNewMemberDigests } from "@/lib/notify";
import { cleanupDetachedMedia } from "@/lib/covers";

// Daily housekeeping (see vercel.json). Vercel calls this with
// "Authorization: Bearer <CRON_SECRET>".
//  1. Permanently deletes content a moderator removed more than a week ago
//     (deleting a cause also deletes its comments, meetups and campaigns).
//  2. Anonymizes accounts deleted more than 30 days ago.
//  3. Re-checks saved representatives that are over 30 days old.
//  4. Cause stages: lapses unconfirmed win proposals, moves causes forward,
//     asks about causes quiet for 90 days and closes them 14 days later.
//  5. Notifications (#18, #95): event reminders, new-member and chat summaries; clears old ones.
//  6. Sends confirmation emails that couldn't go out earlier (#105).
//  7. Deletes uploaded images nothing uses any more (#66).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — the daily clean-up job can't run.");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = { removedAt: { lt: purgeCutoff() } };
  const [causes, comments] = await db.$transaction([db.cause.deleteMany({ where }), db.comment.deleteMany({ where }), db.announcement.deleteMany({ where })]);
  const accounts = await anonymizeExpiredAccounts();
  const reps = await refreshStaleAreaReps();
  const stages = await dailyStageHousekeeping();
  const reminded = await sendEventReminders();
  const memberDigests = await sendNewMemberDigests();
  const chatDigests = await sendChatDigests();
  await pruneNotificationLog();
  const confirmations = await sendDelayedConfirmations((email) =>
    auth.api.sendVerificationEmail({ body: { email, callbackURL: "/me?verified=1" }, headers: new Headers() }),
  );
  // Images whose cause or event was purged above, or that were replaced (#66).
  const images = await cleanupDetachedMedia();
  console.log(
    `Daily clean-up: purged ${causes.count} removed cause(s) and ${comments.count} removed comment(s); anonymized ${accounts} deleted account(s); re-checked representatives for ${reps} area(s); stages: ${stages.moved} moved forward, ${stages.lapsed} win proposal(s) lapsed, ${stages.asked} quiet cause(s) asked, ${stages.closed} closed as quiet; notifications: ${reminded.length} event reminder(s), ${memberDigests} new-member and ${chatDigests} chat summaries; sent ${confirmations} delayed confirmation email(s); deleted ${images} unused image(s).`,
  );
  const notifications = {
    reminders: reminded.length,
    memberDigests,
    chatDigests,
    // Who was told what, for the click-through checks; never in production.
    ...(process.env.NODE_ENV !== "production" && { reminded }),
  };
  return Response.json({ causes: causes.count, comments: comments.count, accounts, reps, stages, notifications, confirmations });
}

/** Constant-time comparison, so the secret can't be guessed from response timing. */
function sameSecret(a: string, b: string) {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
