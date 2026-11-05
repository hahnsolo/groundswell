// A cause's stage follows what actually happens on it (#24). Stages are
// milestones, not gates: a cause shows the furthest one it has reached and can
// skip any of them. Nobody picks a stage from a list; the leader proposes a win
// (members confirm it) or closes the cause. Pure, so it's easy to test.

export const STAGES = ["raised", "gathering", "organizing", "taking_action", "won", "closed"] as const;
export type Stage = (typeof STAGES)[number];

/** The stages that happen on their own, in order. */
const PROGRESS: Stage[] = ["raised", "gathering", "organizing", "taking_action"];

export const GATHERING_MEMBERS = 5;
export const WIN_CONFIRM_DAYS = 7;
export const REOPEN_DAYS = 30;
export const QUIET_DAYS = 90;
export const QUIET_ANSWER_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export const STAGE_LABELS: Record<Stage, string> = {
  raised: "Raised",
  gathering: "Gathering",
  organizing: "Organizing",
  taking_action: "Taking action",
  won: "Won",
  closed: "Closed",
};

export const isActive = (stage: string) => stage !== "won" && stage !== "closed";

/** What has happened on a cause, for working out its stage. */
export type Activity = {
  members: number;
  /** An event has started (or finished). */
  heldEvent: boolean;
  /** A campaign exists, or the leader logged contacting whoever should fix it. */
  tookAction: boolean;
};

/** The furthest stage the activity has reached on its own. */
export function reachedStage(a: Activity): Stage {
  if (a.tookAction) return "taking_action";
  if (a.heldEvent) return "organizing";
  if (a.members >= GATHERING_MEMBERS) return "gathering";
  return "raised";
}

/** Moves forward only: a cause doesn't fall back to Raised because someone left. Won and Closed are only set on purpose. */
export function advance(current: Stage, a: Activity): Stage {
  if (!isActive(current)) return current;
  const next = reachedStage(a);
  return PROGRESS.indexOf(next) > PROGRESS.indexOf(current) ? next : current;
}

/** The next step, in plain words, for a cause still in progress. */
export function nextStep(stage: Stage, members: number) {
  switch (stage) {
    case "raised": {
      const more = Math.max(1, GATHERING_MEMBERS - members);
      return `${more} more ${more === 1 ? "neighbour" : "neighbours"} joining moves this to Gathering.`;
    }
    case "gathering":
      return "Holding a first meetup moves this to Organizing.";
    case "organizing":
      return "Starting a campaign, or contacting whoever should fix it, moves this to Taking action.";
    case "taking_action":
      return "When it's fixed, whoever leads it can propose a win for members to confirm.";
    default:
      return null;
  }
}

/**
 * How many other members must confirm a win: 2, or 1 for a small cause of 3
 * or fewer members (the leader can't confirm their own proposal).
 */
export function confirmationsNeeded(members: number) {
  return members <= 3 ? 1 : 2;
}

export function proposalOpen(p: { createdAt: Date; resolvedAt: Date | null } | null | undefined, now = Date.now()) {
  return !!p && !p.resolvedAt && now - p.createdAt.getTime() < WIN_CONFIRM_DAYS * DAY;
}

export function canReopen(closedAt: Date | null, now = Date.now()) {
  return !!closedAt && now - closedAt.getTime() < REOPEN_DAYS * DAY;
}

/** Quiet for 90 days: time to ask the leader if it's still going. */
export function shouldAskIfStillGoing(lastActivity: Date, askedAt: Date | null, now = Date.now()) {
  return !askedAt && now - lastActivity.getTime() >= QUIET_DAYS * DAY;
}

/** Asked 14 days ago and nothing happened since: close it as "Went quiet". */
export function shouldCloseAsQuiet(lastActivity: Date, askedAt: Date | null, now = Date.now()) {
  return !!askedAt && lastActivity.getTime() <= askedAt.getTime() && now - askedAt.getTime() >= QUIET_ANSWER_DAYS * DAY;
}
