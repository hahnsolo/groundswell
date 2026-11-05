import "server-only";
import { db } from "./db";
import { advance, shouldAskIfStillGoing, shouldCloseAsQuiet, WIN_CONFIRM_DAYS, type Activity, type Stage } from "./stages";

// Saving a cause's stage as things happen (the rules are in ./stages).

export async function activityOf(causeId: string, now = new Date()): Promise<Activity> {
  const [members, heldEvents, campaigns, contacts] = await Promise.all([
    db.causeMember.count({ where: { causeId } }),
    db.meetup.count({ where: { causeId, startsAt: { lte: now } } }),
    db.campaign.count({ where: { causeId } }),
    db.causeAction.count({ where: { causeId, kind: "contacted" } }),
  ]);
  return { members, heldEvent: heldEvents > 0, tookAction: campaigns + contacts > 0 };
}

/** Moves a cause forward if what's happened says it should. Returns the stage. */
export async function refreshStage(causeId: string): Promise<Stage | null> {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { stage: true } });
  if (!cause) return null;
  const next = advance(cause.stage as Stage, await activityOf(causeId));
  if (next !== cause.stage) await db.cause.updateMany({ where: { id: causeId, stage: cause.stage }, data: { stage: next } });
  return next;
}

/**
 * For the daily job: lapse win proposals nobody confirmed in time, move causes
 * forward on time-based milestones, and check in on (then close) quiet causes.
 */
export async function dailyStageHousekeeping(now = new Date()) {
  const lapsed = await db.winProposal.updateMany({
    where: { resolvedAt: null, createdAt: { lt: new Date(now.getTime() - WIN_CONFIRM_DAYS * 24 * 60 * 60 * 1000) } },
    data: { resolvedAt: now, outcome: "lapsed" },
  });

  const active = await db.cause.findMany({ where: { stage: { notIn: ["won", "closed"] }, removedAt: null }, select: { id: true }, take: 2000 });
  let moved = 0;
  for (const { id } of active) {
    const before = await db.cause.findUnique({ where: { id }, select: { stage: true } });
    if ((await refreshStage(id)) !== before?.stage) moved++;
  }

  let asked = 0;
  let closed = 0;
  for (const c of await lastActivity()) {
    if (shouldCloseAsQuiet(c.last, c.quietAskedAt, now.getTime())) {
      await db.cause.update({ where: { id: c.id }, data: { stage: "closed", closedAt: now, closedReason: "Went quiet" } });
      closed++;
    } else if (shouldAskIfStillGoing(c.last, c.quietAskedAt, now.getTime())) {
      await db.cause.update({ where: { id: c.id }, data: { quietAskedAt: now } });
      asked++;
    }
  }
  return { lapsed: lapsed.count, moved, asked, closed };
}

/** When anything last happened on each active cause: new members, messages, events, signatures or logged actions. */
export async function lastActivity(): Promise<{ id: string; leaderId: string; quietAskedAt: Date | null; last: Date }[]> {
  return db.$queryRaw`
    SELECT c."id", c."leaderId", c."quietAskedAt",
      GREATEST(
        c."createdAt",
        COALESCE((SELECT max(m."createdAt") FROM "CauseMember" m WHERE m."causeId" = c."id"), c."createdAt"),
        COALESCE((SELECT max(x."createdAt") FROM "Comment" x WHERE x."causeId" = c."id"), c."createdAt"),
        COALESCE((SELECT max(e."createdAt") FROM "Meetup" e WHERE e."causeId" = c."id"), c."createdAt"),
        COALESCE((SELECT max(s."createdAt") FROM "Signature" s JOIN "Campaign" k ON k."id" = s."campaignId" WHERE k."causeId" = c."id"), c."createdAt"),
        COALESCE((SELECT max(a."createdAt") FROM "CauseAction" a WHERE a."causeId" = c."id"), c."createdAt")
      ) AS "last"
    FROM "Cause" c
    WHERE c."stage" NOT IN ('won', 'closed') AND c."removedAt" IS NULL`;
}
