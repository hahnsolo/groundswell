import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { purgeCutoff } from "@/lib/moderation";

// Daily job (see vercel.json): permanently deletes content a moderator removed
// more than a week ago. Deleting an issue also deletes its comments, meetups and
// campaigns. Vercel calls this with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — removed content is not being purged.");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = { removedAt: { lt: purgeCutoff() } };
  const [issues, comments] = await db.$transaction([db.issue.deleteMany({ where }), db.comment.deleteMany({ where })]);
  console.log(`Purged ${issues.count} removed issue(s) and ${comments.count} removed comment(s).`);
  return Response.json({ issues: issues.count, comments: comments.count });
}

/** Constant-time comparison, so the secret can't be guessed from response timing. */
function sameSecret(a: string, b: string) {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
