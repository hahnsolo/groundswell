// What the people leading a cause can do about messages and members (#71).
// Pure, so it's easy to test. Moderators see every action, and can undo it.

import { shouldAutoHide } from "./moderation";

export const HIDDEN_BY_LEADERS = "Hidden by the people leading this cause";
export const HIDE_REPORT_REASON = "Hidden by someone leading this cause";

export const REMOVED_FROM_CAUSE = "The people leading this cause removed you from it.";
export const CAUSE_NOT_ACCEPTING = "This cause isn't open to new people right now.";

/** Joining, RSVPing and signing aren't open on a closed, hidden or removed cause. */
export function acceptsPeople(cause: { stage: string; hidden: boolean; removedAt: Date | null } | null | undefined) {
  return !!cause && !cause.removedAt && !cause.hidden && cause.stage !== "closed";
}

/** After a leader's Unhide, a message stays hidden if the community's reports would have hidden it anyway. */
export const staysHiddenAfterUnhide = (establishedReportsFromOthers: number) => shouldAutoHide(establishedReportsFromOthers);

/** Leaders can hide any message in their cause, except a moderator's or their own (they can just edit theirs). */
export function canHideMessage(viewer: { id?: string | null; leads: boolean }, author: { id: string; isAdmin?: boolean }) {
  return viewer.leads && !!viewer.id && viewer.id !== author.id && !author.isAdmin;
}

/**
 * Whether the viewer can remove someone from the cause. Returns what's wrong, or null.
 * Co-leaders go through Co-leaders; the leader hands over first.
 */
export function removeProblem(
  viewer: { id?: string | null; leads: boolean },
  target: { id: string; isAdmin?: boolean; isLeader?: boolean; isCoLeader?: boolean },
) {
  if (!viewer.leads || !viewer.id) return "Only the people leading this cause can remove someone from it.";
  if (viewer.id === target.id) return "You can't remove yourself. Leave the cause or hand it over instead.";
  if (target.isLeader) return "The person leading this cause can't be removed.";
  if (target.isCoLeader) return "Co-leaders are removed under Co-leaders.";
  if (target.isAdmin) return "Moderators can't be removed.";
  return null;
}
