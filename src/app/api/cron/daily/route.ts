import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { purgeCutoff } from "@/lib/moderation";
import { anonymizeExpiredAccounts } from "@/lib/leaving";

// Daily housekeeping (see vercel.json). Vercel calls this with
// "Authorization: Bearer <CRON_SECRET>".
//  1. Permanently deletes content a moderator removed more than a week ago
//     (deleting an issue also deletes its comments, meetups and campaigns).
//  2. Anonymizes accounts deleted more than 30 days ago.
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
  const [issues, comments] = await db.$transaction([db.issue.deleteMany({ where }), db.comment.deleteMany({ where })]);
  const accounts = await anonymizeExpiredAccounts();
  console.log(
    `Daily clean-up: purged ${issues.count} removed issue(s) and ${comments.count} removed comment(s); anonymized ${accounts} deleted account(s).`,
  );
  return Response.json({ issues: issues.count, comments: comments.count, accounts });
}

/** Constant-time comparison, so the secret can't be guessed from response timing. */
function sameSecret(a: string, b: string) {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
