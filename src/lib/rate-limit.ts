import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";

/**
 * Fixed-window rate limit stored in the database, so limits survive restarts
 * and are shared by every server instance. Returns true if the action is allowed.
 *
 *   if (!(await rateLimit(`comment:${user.id}`, 60, HOUR))) return { error: "Slow down" };
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const id = createHash("sha256").update(key).digest("hex");
  const now = new Date();

  // Common case: inside an open window with room left — one atomic increment.
  const takeASlot = async () => {
    const { count } = await db.throttle.updateMany({
      where: { key: id, resetAt: { gt: now }, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    return count === 1;
  };
  if (await takeASlot()) return true;

  // The window is full, or there isn't an open one. Try to start a new one. People
  // on one network often arrive together, so each step is atomic: when several
  // requests get here at once, exactly one of them starts the window.
  const resetAt = new Date(now.getTime() + windowMs);
  const { count: restarted } = await db.throttle.updateMany({
    where: { key: id, resetAt: { lte: now } },
    data: { count: 1, resetAt },
  });
  const started =
    restarted === 1 || (await db.throttle.createMany({ data: [{ key: id, count: 1, resetAt }], skipDuplicates: true })).count === 1;

  // Didn't start it: it's either really full, or someone else started it just now.
  if (!started) return takeASlot();

  // Occasionally sweep long-expired rows so the table stays small.
  if (Math.random() < 0.01) {
    await db.throttle.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * HOUR) } } });
  }
  return true;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

/** Best-effort client IP. Behind Vercel/Cloudflare/most hosts the first x-forwarded-for entry is the client. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
