import { LEAD_OFFER_DAYS } from "./leadership";
import { confirmationsNeeded, isActive, WIN_CONFIRM_DAYS } from "./stages";

// "Needs you" on /me (#75): what's waiting on this person across the causes
// they lead or belong to, so they don't have to open each one. Pure, so it's
// easy to test; src/lib/leader-home.ts gathers the rows.

const DAY = 24 * 60 * 60 * 1000;
export const HOSTING_SOON_DAYS = 7;
/** With no "last looked" yet, members who joined in the last week count as new. */
export const NEW_MEMBER_DAYS = 7;

export type NeedKind = "lead_offer" | "co_lead" | "still_going" | "confirm_win" | "your_win" | "reports" | "hosting" | "new_members";

export type Need = { kind: NeedKind; text: string; href: string; key: string };

export type NeedsInput = {
  leadOffers: { causeId: string; causeTitle: string; fromName: string; createdAt: Date; answeredAt: Date | null }[];
  coLeadInvites: { causeId: string; causeTitle: string; inviterName: string; createdAt: Date; acceptedAt: Date | null }[];
  /** Open win proposals on causes they belong to. */
  wins: { causeId: string; causeTitle: string; proposerName: string; proposedByMe: boolean; confirmedByMe: boolean; confirmed: number; members: number; createdAt: Date; resolvedAt: Date | null }[];
  /** The causes they lead or co-lead, with how many joined since they last looked. */
  led: { id: string; title: string; stage: string; quietAskedAt: Date | null; newMembers: number }[];
  hosting: { id: string; title: string; startsAt: Date }[];
  /** Reports waiting for a moderator, on causes they lead (the cause or its chat). */
  reports: { causeId: string; causeTitle: string; count: number }[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Everything waiting on them, most pressing first. Empty when there's nothing to do. */
export function needsYou(input: NeedsInput, now = Date.now()): Need[] {
  const out: Need[] = [];
  for (const o of input.leadOffers) {
    if (o.answeredAt || now - o.createdAt.getTime() >= LEAD_OFFER_DAYS * DAY) continue;
    out.push({ kind: "lead_offer", key: `lo-${o.causeId}`, text: `${o.fromName} asked you to lead "${o.causeTitle}". Accept or decline.`, href: `/causes/${o.causeId}` });
  }
  for (const c of input.coLeadInvites) {
    if (c.acceptedAt || now - c.createdAt.getTime() >= LEAD_OFFER_DAYS * DAY) continue;
    out.push({ kind: "co_lead", key: `cl-${c.causeId}`, text: `${c.inviterName} asked you to co-lead "${c.causeTitle}". Accept or decline.`, href: `/causes/${c.causeId}` });
  }
  for (const l of input.led) {
    if (l.quietAskedAt && isActive(l.stage)) out.push({ kind: "still_going", key: `sg-${l.id}`, text: `Is "${l.title}" still going? Say so, or it closes as "went quiet".`, href: `/causes/${l.id}` });
  }
  for (const w of input.wins) {
    if (w.resolvedAt || now - w.createdAt.getTime() >= WIN_CONFIRM_DAYS * DAY) continue;
    const needed = confirmationsNeeded(w.members);
    if (w.proposedByMe) {
      out.push({ kind: "your_win", key: `yw-${w.causeId}`, text: `Your win on "${w.causeTitle}" is waiting: ${w.confirmed} of ${needed} confirmations.`, href: `/causes/${w.causeId}#win` });
    } else if (!w.confirmedByMe) {
      out.push({ kind: "confirm_win", key: `cw-${w.causeId}`, text: `${w.proposerName} says "${w.causeTitle}" is fixed. Is it?`, href: `/causes/${w.causeId}#win` });
    }
  }
  for (const r of input.reports) {
    if (r.count > 0) out.push({ kind: "reports", key: `rp-${r.causeId}`, text: `${plural(r.count, "report", "reports")} on "${r.causeTitle}" waiting for a moderator.`, href: `/causes/${r.causeId}` });
  }
  for (const h of [...input.hosting].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const t = h.startsAt.getTime();
    if (t < now || t >= now + HOSTING_SOON_DAYS * DAY) continue;
    out.push({ kind: "hosting", key: `ho-${h.id}`, text: `You're hosting "${h.title}" this week.`, href: `/events/${h.id}` });
  }
  for (const l of input.led) {
    if (l.newMembers > 0 && isActive(l.stage)) {
      out.push({ kind: "new_members", key: `nm-${l.id}`, text: `${plural(l.newMembers, "new member", "new members")} in "${l.title}" since you last looked.`, href: `/causes/${l.id}#leader` });
    }
  }
  return out;
}
