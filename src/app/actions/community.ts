"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { notifyWinCheck, notifyWon } from "@/lib/notify";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser, UNVERIFIED_ERROR, type CurrentUser } from "@/lib/auth";
import { CATEGORY_IDS } from "@/lib/categories";
import { parsePostal } from "@/lib/countries";
import { resolvePlace } from "@/lib/places";
import { honeypotTripped, linkError, withinPostingLimit } from "@/lib/spam";
import { HOUR, rateLimit } from "@/lib/rate-limit";
import { ESTABLISHED_ACCOUNT_MS, shouldAutoHide } from "@/lib/moderation";
import { handOverMeetup, leaveCause } from "@/lib/leaving";
import { chatAccess } from "@/lib/chat-rules";
import { announceChatChange } from "@/lib/live-chat";
import { descriptionProblem } from "@/lib/words";
import { FIXER_IDS, FIXER_OTHER_MAX, type FixerId } from "@/lib/fixers";
import { endProblem } from "@/lib/event-times";
import { canEditCause, canEditEvent, canEditMessage, MESSAGE_EDIT_MINUTES } from "@/lib/editing";
import { canInviteCoLeader, canOfferLead, coLeadInviteOpen, LEAD_OFFER_DAYS, leadsCause, offerOpen } from "@/lib/leadership";
import { canReopen, confirmationsNeeded, isActive, proposalOpen } from "@/lib/stages";
import { refreshStage } from "@/lib/cause-stage";
import { canLeadAnother, LIMIT_REACHED } from "@/lib/leading-limit";
import { getActiveLedCauses } from "@/lib/queries";
import { appUrl, sendEmail } from "@/lib/mail";
import { fromZodError, type FormState } from "@/lib/forms";

const id = z.string().min(1).max(40);

const LIMIT_MESSAGES = {
  cause: "You've started a lot of causes this hour. Try again later.",
  comment: "Slow down a little — try again shortly.",
  meetup: "You've created several meetups this hour. Try again later.",
  campaign: "You've started several campaigns this hour. Try again later.",
} as const;

/** Spam checks shared by everything people post. Returns an error state, or null if it's fine. */
async function spamCheck(
  user: CurrentUser,
  formData: FormData,
  kind: keyof typeof LIMIT_MESSAGES,
  ...texts: (string | undefined)[]
): Promise<FormState> {
  if (honeypotTripped(formData)) return { error: "Something went wrong. Please try again." };
  const links = linkError(user, ...texts);
  if (links) return { error: links };
  if (!(await withinPostingLimit(user, kind))) return { error: LIMIT_MESSAGES[kind] };
  return null;
}

const CAUSE_GONE: FormState = { error: "This cause is no longer available." };

/** What's needed to tell who leads a cause: its leader and co-leaders (see leadsCause). */
const LEADERS = { leaderId: true, coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } } } as const;

/** Edits go through the same honeypot and link rules as new posts, but don't count against posting limits. */
function editCheck(user: CurrentUser, formData: FormData, ...texts: (string | undefined)[]): FormState {
  if (honeypotTripped(formData)) return { error: "Something went wrong. Please try again." };
  const links = linkError(user, ...texts);
  return links ? { error: links } : null;
}

/** Comments, meetups and campaigns can only be added to causes a moderator hasn't removed. */
async function causeOpen(causeId: string) {
  // Removed by a moderator, or closed by its leader: read-only from then on.
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { removedAt: true, stage: true } });
  return !!cause && !cause.removedAt && cause.stage !== "closed";
}

// ---------- Causes ----------

// Who should fix it: one of the choices, plus what they wrote for "Something else".
const fixerFields = {
  fixer: z.enum(FIXER_IDS, { errorMap: () => ({ message: "Pick who you think should fix it. Not sure is fine." }) }),
  fixerOther: z.string().trim().max(FIXER_OTHER_MAX).optional(),
};
const fixerOtherMissing = (d: { fixer: string; fixerOther?: string }) => d.fixer === "other" && !d.fixerOther;
const FIXER_OTHER_MISSING = { fieldErrors: { fixerOther: ["Say who, for example: the school board."] } };
const fixerData = (d: { fixer: FixerId; fixerOther?: string }) => ({ fixer: d.fixer, fixerOther: d.fixer === "other" ? d.fixerOther : null });

const causeSchema = z.object({
  country: z.string(),
  postal: z.string(),
  title: z.string().trim().min(8, "Give it a clear title (8+ characters).").max(120),
  description: z
    .string()
    .trim()
    .max(20000)
    .superRefine((text, ctx) => {
      const problem = descriptionProblem(text);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }),
  category: z.enum(CATEGORY_IDS, { errorMap: () => ({ message: "Pick a category." }) }),
  ...fixerFields,
});

export async function createCause(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  if (!canLeadAnother((await getActiveLedCauses(user.id)).length, user.isAdmin)) return { error: LIMIT_REACHED };
  const parsed = causeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (fixerOtherMissing(parsed.data)) return FIXER_OTHER_MISSING;
  const spam = await spamCheck(user, formData, "cause", parsed.data.title, parsed.data.description, parsed.data.fixerOther);
  if (spam) return spam;

  const postal = parsePostal(parsed.data.country, parsed.data.postal);
  if (!postal.ok) return { fieldErrors: { postal: [postal.error] } };

  let place;
  try {
    place = await resolvePlace(postal.country.code, postal.postal);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!place) return { fieldErrors: { postal: ["We couldn't find that code."] } };

  const cause = await db.cause.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      ...fixerData(parsed.data),
      country: place.country,
      postalCode: place.postalCode,
      placeName: place.placeName,
      region: place.regionCode,
      lat: place.lat,
      lng: place.lng,
      authorId: user.id,
      leaderId: user.id,
      // The author obviously cares about it.
      members: { create: { userId: user.id } },
    },
  });
  redirect(`/causes/${cause.id}`);
}

// ---------- Stages: winning, closing, the timeline (#24) ----------
// Stages move forward on their own (src/lib/stages.ts). The leader can only
// propose a win (members confirm it), close the cause, or log what they did.

/** The leader of an active cause, or null. */
async function leadingActiveCause(causeId: string, userId: string) {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { ...LEADERS, stage: true, removedAt: true, title: true } });
  return cause && leadsCause(cause, userId) && !cause.removedAt && isActive(cause.stage) ? cause : null;
}

/** "It's fixed": the leader proposes a win for members to confirm. */
export async function proposeWin(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, note: z.string().trim().min(10, "Say what happened, so members can check (10+ characters).").max(500) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await leadingActiveCause(parsed.data.causeId, user.id))) return { error: "Only the person leading this cause can propose a win." };
  const problem = editCheck(user, formData, parsed.data.note);
  if (problem) return problem;
  await db.$transaction([
    db.winProposal.updateMany({ where: { causeId: parsed.data.causeId, resolvedAt: null }, data: { resolvedAt: new Date(), outcome: "withdrawn" } }),
    db.winProposal.create({ data: { causeId: parsed.data.causeId, proposedById: user.id, note: parsed.data.note } }),
  ]);
  after(() => notifyWinCheck(parsed.data.causeId, user.id)); // "Is it fixed?" emails, after the page updates
  refresh();
  return { ok: true };
}

export async function withdrawWin(formData: FormData) {
  const user = await requireUser();
  const proposalId = id.parse(formData.get("proposalId"));
  await db.winProposal.updateMany({ where: { id: proposalId, proposedById: user.id, resolvedAt: null }, data: { resolvedAt: new Date(), outcome: "withdrawn" } });
  refresh();
}

/** A member (not the leader) confirms "yes, it's fixed". Enough confirmations make it Won. */
export async function confirmWin(formData: FormData) {
  const user = await requireUser();
  const proposalId = id.parse(formData.get("proposalId"));
  const proposal = await db.winProposal.findUnique({ where: { id: proposalId }, include: { cause: { select: { id: true, stage: true } } } });
  if (!proposal || !proposalOpen(proposal) || proposal.proposedById === user.id || !isActive(proposal.cause.stage)) return;
  const member = await db.causeMember.findUnique({ where: { causeId_userId: { causeId: proposal.causeId, userId: user.id } } });
  if (!member) return;
  await db.winConfirmation.upsert({ where: { proposalId_userId: { proposalId, userId: user.id } }, create: { proposalId, userId: user.id }, update: {} });
  const [confirmed, members] = await Promise.all([
    db.winConfirmation.count({ where: { proposalId } }),
    db.causeMember.count({ where: { causeId: proposal.causeId } }),
  ]);
  if (confirmed >= confirmationsNeeded(members)) {
    await db.$transaction([
      db.winProposal.update({ where: { id: proposalId }, data: { resolvedAt: new Date(), outcome: "won" } }),
      db.cause.update({ where: { id: proposal.causeId }, data: { stage: "won", resolvedAt: new Date() } }),
    ]);
    after(() => notifyWon(proposal.causeId));
  }
  refresh();
}

/** The leader closes a cause that's stopped, with a reason. */
export async function closeCause(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, reason: z.string().trim().min(5, "Say why, in a few words, so members know.").max(300) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await leadingActiveCause(parsed.data.causeId, user.id))) return { error: "Only the person leading this cause can close it." };
  const problem = editCheck(user, formData, parsed.data.reason);
  if (problem) return problem;
  await db.$transaction([
    db.winProposal.updateMany({ where: { causeId: parsed.data.causeId, resolvedAt: null }, data: { resolvedAt: new Date(), outcome: "withdrawn" } }),
    db.cause.update({ where: { id: parsed.data.causeId }, data: { stage: "closed", closedAt: new Date(), closedReason: parsed.data.reason } }),
  ]);
  refresh();
  return { ok: true };
}

/** The leader reopens a closed cause within 30 days. It picks up from what's happened. */
export async function reopenCause(formData: FormData) {
  const user = await requireUser();
  const causeId = id.parse(formData.get("causeId"));
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { ...LEADERS, stage: true, closedAt: true, removedAt: true } });
  if (!cause || !leadsCause(cause, user.id) || cause.stage !== "closed" || cause.removedAt || !canReopen(cause.closedAt)) return;
  if (!canLeadAnother((await getActiveLedCauses(user.id)).length, user.isAdmin)) return; // reopening makes it count again
  await db.cause.update({ where: { id: causeId }, data: { stage: "raised", closedAt: null, closedReason: null, quietAskedAt: null } });
  await refreshStage(causeId);
  refresh();
}

const HOW = ["letter", "email", "call", "meeting"] as const;

/** The leader logs contacting whoever should fix it. Moves the cause to Taking action. */
export async function logContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      causeId: id,
      who: z.string().trim().min(2, "Who did you contact?").max(120),
      how: z.enum(HOW, { errorMap: () => ({ message: "How did you contact them?" }) }),
      happenedAt: z.coerce.date({ errorMap: () => ({ message: "When was it?" }) }),
      note: z.string().trim().max(500).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await leadingActiveCause(parsed.data.causeId, user.id))) return { error: "Only the person leading this cause can add to its timeline." };
  if (parsed.data.happenedAt.getTime() > Date.now() + 60 * 60 * 1000) return { fieldErrors: { happenedAt: ["That's in the future."] } };
  const problem = editCheck(user, formData, parsed.data.who, parsed.data.note);
  if (problem) return problem;
  const { causeId, note, ...rest } = parsed.data;
  await db.causeAction.create({ data: { causeId, createdById: user.id, kind: "contacted", note: note || null, ...rest } });
  await refreshStage(causeId);
  refresh();
  return { ok: true };
}

/** The leader notes that whoever they contacted replied. */
export async function logReply(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, note: z.string().trim().min(3, "What did they say, in a few words?").max(500) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await leadingActiveCause(parsed.data.causeId, user.id))) return { error: "Only the person leading this cause can add to its timeline." };
  const problem = editCheck(user, formData, parsed.data.note);
  if (problem) return problem;
  await db.causeAction.create({ data: { causeId: parsed.data.causeId, createdById: user.id, kind: "replied", note: parsed.data.note } });
  refresh();
  return { ok: true };
}

/** "Yes, it's still going": answers the 90-day check-in. */
export async function stillGoing(formData: FormData) {
  const user = await requireUser();
  const causeId = id.parse(formData.get("causeId"));
  if (!(await leadingActiveCause(causeId, user.id))) return;
  await db.$transaction([
    db.causeAction.create({ data: { causeId, createdById: user.id, kind: "still_going" } }),
    db.cause.update({ where: { id: causeId }, data: { quietAskedAt: null } }),
  ]);
  refresh();
}

/** The person who started a cause can fix its title and description (same rules as when starting it). */
export async function editCause(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = causeSchema.pick({ title: true, description: true }).extend({ causeId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const cause = await db.cause.findUnique({ where: { id: parsed.data.causeId }, select: { ...LEADERS, removedAt: true } });
  if (!cause || !canEditCause(cause, user.id)) return { error: "Only the people leading this cause can change it." };
  const problem = editCheck(user, formData, parsed.data.title, parsed.data.description);
  if (problem) return problem;
  await db.cause.update({
    where: { id: parsed.data.causeId },
    data: { title: parsed.data.title, description: parsed.data.description, editedAt: new Date() },
  });
  refresh();
  return { ok: true };
}

/**
 * The person who started a cause can add someone to contact by hand: a
 * councillor we don't have for their city, a landlord, a school board. Blank clears it.
 */
export async function setCauseContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      causeId: id,
      contactName: z.string().trim().max(80),
      contactRole: z.string().trim().max(80).default(""),
      contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("That email doesn't look right.").max(120)]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const cause = await db.cause.findUnique({ where: { id: parsed.data.causeId }, select: { ...LEADERS, removedAt: true } });
  if (!cause || !canEditCause(cause, user.id)) return { error: "Only the people leading this cause can change this." };
  const { contactName, contactRole, contactEmail } = parsed.data;
  const problem = editCheck(user, formData, contactName, contactRole);
  if (problem) return problem;
  await db.cause.update({
    where: { id: parsed.data.causeId },
    data: contactName ? { contactName, contactRole: contactRole || null, contactEmail: contactEmail || null } : { contactName: null, contactRole: null, contactEmail: null },
  });
  refresh();
  return { ok: true };
}

// ---------- Handing over the lead ----------

/** The leader offers the lead to a member. Replaces any offer still waiting for an answer. */
export async function offerLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, toUserId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick who should take over." };
  const { causeId, toUserId } = parsed.data;
  const [cause, membership] = await Promise.all([
    db.cause.findUnique({ where: { id: causeId }, select: { leaderId: true, removedAt: true, title: true } }),
    db.causeMember.findUnique({
      where: { causeId_userId: { causeId, userId: toUserId } },
      select: { user: { select: { name: true, email: true, deactivatedAt: true } } },
    }),
  ]);
  if (!cause) return CAUSE_GONE;
  const problem = canOfferLead(cause, user.id, { userId: toUserId, isMember: !!membership && !membership.user.deactivatedAt });
  if (problem || !membership) return { error: problem ?? "You can only hand a cause to someone who has joined it." };
  await db.$transaction([
    db.leadOffer.updateMany({ where: { causeId, answeredAt: null }, data: { answeredAt: new Date(), accepted: false } }),
    db.leadOffer.create({ data: { causeId, fromUserId: user.id, toUserId } }),
  ]);
  try {
    await sendEmail({
      to: membership.user.email,
      subject: `${user.name} would like you to lead "${cause.title}"`,
      text: `Hi ${membership.user.name},\n\n${user.name} has asked you to take over leading "${cause.title}" on Groundswell. You'd be able to edit it, move it forward and organize around it; ${user.name} stays on as a member.\n\nAccept or decline here (the offer is open for ${LEAD_OFFER_DAYS} days):\n${appUrl(`/causes/${causeId}`)}\n\nThanks for caring about your neighbourhood!`,
    });
  } catch (e) {
    console.warn("Lead offer email failed:", (e as Error).message); // the offer still shows on the cause
  }
  refresh();
  return { ok: true };
}

/** The leader takes back an offer nobody has answered yet. */
export async function withdrawLeadOffer(formData: FormData) {
  const user = await requireUser();
  const offerId = id.parse(formData.get("offerId"));
  await db.leadOffer.updateMany({ where: { id: offerId, fromUserId: user.id, answeredAt: null }, data: { answeredAt: new Date(), accepted: false } });
  refresh();
}

/** The person offered the lead accepts or declines. */
export async function answerLeadOffer(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ offerId: id, answer: z.enum(["accept", "decline"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const offer = await db.leadOffer.findUnique({
    where: { id: parsed.data.offerId },
    include: { cause: { select: { title: true, leaderId: true, removedAt: true } }, from: { select: { name: true, email: true } } },
  });
  if (!offer || offer.toUserId !== user.id || !offerOpen(offer)) return;
  const accept = parsed.data.answer === "accept";
  if (accept) {
    // Only if nothing changed meanwhile: they're still a member, and the person who offered still leads it.
    const stillMember = await db.causeMember.findUnique({ where: { causeId_userId: { causeId: offer.causeId, userId: user.id } } });
    if (!stillMember || offer.cause.leaderId !== offer.fromUserId || offer.cause.removedAt) return;
    // Taking it on counts toward their limit (unless they co-lead it already, so it counts already);
    // the notice explains and offers Decline instead.
    const coLeading = await db.coLeader.findFirst({ where: { causeId: offer.causeId, userId: user.id, acceptedAt: { not: null } } });
    if (!coLeading && !canLeadAnother((await getActiveLedCauses(user.id)).length, user.isAdmin)) return;
  }
  await db.$transaction([
    db.leadOffer.update({ where: { id: offer.id }, data: { answeredAt: new Date(), accepted: accept } }),
    ...(accept
      ? [
          db.cause.update({ where: { id: offer.causeId }, data: { leaderId: user.id } }),
          // A co-leader who takes over is simply the leader now.
          db.coLeader.deleteMany({ where: { causeId: offer.causeId, userId: user.id } }),
        ]
      : []),
  ]);
  try {
    await sendEmail({
      to: offer.from.email,
      subject: accept ? `${user.name} now leads "${offer.cause.title}"` : `${user.name} can't take over "${offer.cause.title}"`,
      text: accept
        ? `Hi ${offer.from.name},\n\n${user.name} accepted and now leads "${offer.cause.title}". You're still a member.\n\n${appUrl(`/causes/${offer.causeId}`)}`
        : `Hi ${offer.from.name},\n\n${user.name} isn't able to lead "${offer.cause.title}" right now. You still lead it, and you can offer it to someone else:\n${appUrl(`/causes/${offer.causeId}`)}`,
    });
  } catch (e) {
    console.warn("Lead answer email failed:", (e as Error).message);
  }
  refresh();
}

// ---------- Co-leaders (#42) ----------

/** The leader invites a member to co-lead. */
export async function inviteCoLeader(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, toUserId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick who to invite." };
  const { causeId, toUserId } = parsed.data;
  const [cause, membership] = await Promise.all([
    db.cause.findUnique({ where: { id: causeId }, select: { ...LEADERS, removedAt: true, title: true, stage: true } }),
    db.causeMember.findUnique({
      where: { causeId_userId: { causeId, userId: toUserId } },
      select: { user: { select: { name: true, email: true, deactivatedAt: true } } },
    }),
  ]);
  if (!cause) return CAUSE_GONE;
  if (!isActive(cause.stage)) return { error: "This cause isn't active any more." };
  const problem = canInviteCoLeader(cause, user.id, { userId: toUserId, isMember: !!membership && !membership.user.deactivatedAt });
  if (problem || !membership) return { error: problem ?? "You can only invite someone who has joined the cause." };
  // A lapsed invite to the same person is replaced.
  await db.coLeader.upsert({
    where: { causeId_userId: { causeId, userId: toUserId } },
    create: { causeId, userId: toUserId, invitedById: user.id },
    update: { invitedById: user.id, createdAt: new Date(), acceptedAt: null },
  });
  try {
    await sendEmail({
      to: membership.user.email,
      subject: `${user.name} would like you to co-lead "${cause.title}"`,
      text: `Hi ${membership.user.name},\n\n${user.name} has asked you to help lead "${cause.title}" on Groundswell. Co-leaders can edit the cause, move it forward and organize around it, alongside ${user.name}.\n\nAccept or decline here (the invite is open for ${LEAD_OFFER_DAYS} days):\n${appUrl(`/causes/${causeId}`)}\n\nThanks for caring about your neighbourhood!`,
    });
  } catch (e) {
    console.warn("Co-lead invite email failed:", (e as Error).message); // the invite still shows on the cause
  }
  refresh();
  return { ok: true };
}

/** The person invited accepts (if under their leading limit) or declines. */
export async function answerCoLeadInvite(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, answer: z.enum(["accept", "decline"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const key = { causeId_userId: { causeId: parsed.data.causeId, userId: user.id } };
  const invite = await db.coLeader.findUnique({ where: key, include: { invitedBy: { select: { name: true, email: true } }, cause: { select: { title: true, removedAt: true } } } });
  if (!invite || !coLeadInviteOpen(invite)) return;
  if (parsed.data.answer === "decline") {
    await db.coLeader.delete({ where: key });
  } else {
    const member = await db.causeMember.findUnique({ where: key });
    if (!member || invite.cause.removedAt) return;
    if (!canLeadAnother((await getActiveLedCauses(user.id)).length, user.isAdmin)) return; // the notice explains
    await db.coLeader.update({ where: key, data: { acceptedAt: new Date() } });
  }
  try {
    const accepted = parsed.data.answer === "accept";
    await sendEmail({
      to: invite.invitedBy.email,
      subject: accepted ? `${user.name} is now co-leading "${invite.cause.title}"` : `${user.name} can't co-lead "${invite.cause.title}"`,
      text: `Hi ${invite.invitedBy.name},\n\n${user.name} ${accepted ? "accepted and now co-leads" : "isn't able to co-lead"} "${invite.cause.title}".\n\n${appUrl(`/causes/${parsed.data.causeId}`)}`,
    });
  } catch (e) {
    console.warn("Co-lead answer email failed:", (e as Error).message);
  }
  refresh();
}

/** The leader removes a co-leader (or takes back an invite), or a co-leader steps down. They stay a member. */
export async function removeCoLeader(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, userId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const cause = await db.cause.findUnique({ where: { id: parsed.data.causeId }, select: { leaderId: true } });
  if (!cause || (cause.leaderId !== user.id && parsed.data.userId !== user.id)) return;
  await db.coLeader.deleteMany({ where: { causeId: parsed.data.causeId, userId: parsed.data.userId } });
  refresh();
}

/** The person leading a cause can change who they think should fix it. */
export async function setCauseFixer(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, ...fixerFields }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (fixerOtherMissing(parsed.data)) return FIXER_OTHER_MISSING;
  const links = linkError(user, parsed.data.fixerOther);
  if (links) return { error: links };
  const cause = await db.cause.findUnique({ where: { id: parsed.data.causeId }, select: { ...LEADERS, removedAt: true } });
  if (!cause || !canEditCause(cause, user.id)) return { error: "Only the people leading this cause can change this." };
  await db.cause.update({ where: { id: parsed.data.causeId }, data: fixerData(parsed.data) });
  refresh();
  return { ok: true };
}

export async function toggleMembership(formData: FormData) {
  const causeId = id.parse(formData.get("causeId"));
  const user = await requireUser(`/causes/${causeId}`);
  const key = { causeId_userId: { causeId, userId: user.id } };
  const existing = await db.causeMember.findUnique({ where: key });
  if (existing) {
    // The leader hands the cause over before leaving.
    const cause = await db.cause.findUnique({ where: { id: causeId }, select: { leaderId: true } });
    if (cause?.leaderId === user.id) return;
    await db.causeMember.delete({ where: key });
    await db.coLeader.deleteMany({ where: { causeId, userId: user.id } }); // co-leading needs membership
  } else {
    await db.causeMember.create({ data: { causeId, userId: user.id } });
    await refreshStage(causeId); // the fifth member moves it to Gathering
  }
  refresh();
}

// ---------- Discussion ----------

const commentSchema = z.object({
  causeId: id,
  body: z.string().trim().min(1, "Write something first.").max(3000),
});

export async function addComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await causeOpen(parsed.data.causeId))) return CAUSE_GONE;
  // The chat is for members, and new members read along for a day first.
  const [cause, membership] = await Promise.all([
    db.cause.findUnique({ where: { id: parsed.data.causeId }, select: LEADERS }),
    db.causeMember.findUnique({ where: { causeId_userId: { causeId: parsed.data.causeId, userId: user.id } }, select: { createdAt: true } }),
  ]);
  const access = chatAccess({
    signedIn: true,
    isAdmin: user.isAdmin,
    isLeader: !!cause && leadsCause(cause, user.id),
    joinedAt: membership?.createdAt ?? null,
    emailVerified: user.emailVerified,
  });
  if (access.kind === "join") return { error: "Join this cause to take part in the chat." };
  if (access.kind === "read") return { error: "New members can post in the chat a day after joining." };
  const spam = await spamCheck(user, formData, "comment", parsed.data.body);
  if (spam) return spam;
  // Same text posted again within 10 minutes is almost always a double-click or a bot.
  const duplicate = await db.comment.findFirst({
    where: { authorId: user.id, body: parsed.data.body, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (duplicate) return { error: "You just posted that." };
  await db.comment.create({ data: { ...parsed.data, authorId: user.id } });
  announceChatChange(parsed.data.causeId);
  refresh();
  return { ok: true };
}

/** Fix your own chat message, within 15 minutes of sending it. */
export async function editComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ commentId: id, body: commentSchema.shape.body }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const comment = await db.comment.findUnique({
    where: { id: parsed.data.commentId },
    select: { authorId: true, causeId: true, createdAt: true, removedAt: true, hidden: true, body: true },
  });
  if (!comment || !canEditMessage(comment, user.id)) {
    return { error: `Messages can only be changed for ${MESSAGE_EDIT_MINUTES} minutes after sending.` };
  }
  if (comment.body === parsed.data.body) return { ok: true };
  const problem = editCheck(user, formData, parsed.data.body);
  if (problem) return problem;
  await db.comment.update({ where: { id: parsed.data.commentId }, data: { body: parsed.data.body, editedAt: new Date() } });
  announceChatChange(comment.causeId);
  refresh();
  return { ok: true };
}

// ---------- Meetups ----------

const meetupSchema = z.object({
  causeId: id,
  title: z.string().trim().min(4, "Add a title.").max(120),
  description: z.string().trim().max(3000).default(""),
  startsAt: z.coerce.date({ errorMap: () => ({ message: "Pick a date and time." }) }),
  endsAt: z.coerce.date({ errorMap: () => ({ message: "Pick when it ends." }) }),
  location: z.string().trim().min(3, "Where is it? (an address, venue or video link)").max(300),
  isOnline: z.literal("on").optional(),
  capacity: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(2).max(10000).optional()),
});

export async function createMeetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = meetupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await causeOpen(parsed.data.causeId))) return CAUSE_GONE;
  if (parsed.data.startsAt.getTime() < Date.now()) {
    return { fieldErrors: { startsAt: ["Pick a time in the future."] } };
  }
  const badEnd = endProblem(parsed.data.startsAt, parsed.data.endsAt);
  if (badEnd) return { fieldErrors: { endsAt: [badEnd] } };
  const { isOnline, ...data } = parsed.data;
  // The venue of an online meetup *is* a link, so it doesn't count against the limit.
  const spam = await spamCheck(user, formData, "meetup", data.title, data.description, isOnline ? undefined : data.location);
  if (spam) return spam;
  const meetup = await db.meetup.create({
    data: {
      ...data,
      isOnline: isOnline === "on",
      organizerId: user.id,
      rsvps: { create: { userId: user.id } },
    },
  });
  redirect(`/events/${meetup.id}`);
}

/** The host changes an event's details, until it's over. */
export async function editMeetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = meetupSchema.omit({ causeId: true }).extend({ meetupId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const meetup = await db.meetup.findUnique({
    where: { id: parsed.data.meetupId },
    select: { organizerId: true, startsAt: true, endsAt: true, causeId: true, cause: { select: { removedAt: true } }, _count: { select: { rsvps: true } } },
  });
  if (!meetup || !canEditEvent(meetup, user.id)) return { error: "Only the host can change this event, until it's over." };
  const { meetupId, isOnline, ...data } = parsed.data;
  // Moving the start is fine, but not into the past (an event already on keeps its start).
  if (data.startsAt.getTime() !== meetup.startsAt.getTime() && data.startsAt.getTime() < Date.now()) {
    return { fieldErrors: { startsAt: ["Pick a time in the future."] } };
  }
  const badEnd = endProblem(data.startsAt, data.endsAt);
  if (badEnd) return { fieldErrors: { endsAt: [badEnd] } };
  if (data.capacity && data.capacity < meetup._count.rsvps) {
    return { fieldErrors: { capacity: [`${meetup._count.rsvps} people are already going, so the limit can't be lower than that.`] } };
  }
  const problem = editCheck(user, formData, data.title, data.description, isOnline ? undefined : data.location);
  if (problem) return problem;
  await db.meetup.update({
    where: { id: meetupId },
    data: { ...data, capacity: data.capacity ?? null, isOnline: isOnline === "on", editedAt: new Date() },
  });
  refresh();
  return { ok: true };
}

export async function toggleRsvp(formData: FormData) {
  const meetupId = id.parse(formData.get("meetupId"));
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    select: { causeId: true, organizerId: true, capacity: true, _count: { select: { rsvps: true } } },
  });
  if (!meetup) return;
  const user = await requireUser(`/causes/${meetup.causeId}`);
  // Hosts don't un-RSVP from their own meetup; they step down (below) so it passes to someone.
  if (meetup.organizerId === user.id) return;
  const key = { meetupId_userId: { meetupId, userId: user.id } };
  const existing = await db.rsvp.findUnique({ where: key });
  if (existing) await db.rsvp.delete({ where: key });
  else if (!meetup.capacity || meetup._count.rsvps < meetup.capacity) {
    await db.rsvp.create({ data: { meetupId, userId: user.id } });
  }
  refresh();
}

/** The host can't make it (or doesn't want to): pass the meetup to the earliest RSVP, or cancel it. */
export async function stepDownAsHost(formData: FormData) {
  const meetupId = id.parse(formData.get("meetupId"));
  const meetup = await db.meetup.findUnique({ where: { id: meetupId }, select: { causeId: true, startsAt: true } });
  if (!meetup) return;
  const user = await requireUser(`/causes/${meetup.causeId}`);
  if (meetup.startsAt.getTime() <= Date.now()) return;
  await handOverMeetup(meetupId, user.id); // does nothing unless they're the host
  refresh();
}

// ---------- Leaving a cause ----------

/** Take back support, RSVPs and signatures on a cause in one go. Comments stay. */
export async function leaveCauseAction(formData: FormData) {
  const causeId = id.parse(formData.get("causeId"));
  const user = await requireUser(`/causes/${causeId}`);
  // The leader hands the cause over first; otherwise it'd be led by someone who isn't in it.
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { leaderId: true } });
  if (cause?.leaderId === user.id) return;
  await leaveCause(user.id, causeId);
  refresh();
}

// ---------- Advocacy ----------

const campaignSchema = z.object({
  causeId: id,
  target: z.string().trim().min(3, "Who needs to act? e.g. \"City Council\".").max(150),
  ask: z.string().trim().min(20, "Spell out exactly what you're asking for (20+ characters).").max(2000),
  goal: z.coerce.number().int().min(5).max(1_000_000).default(100),
});

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await causeOpen(parsed.data.causeId))) return CAUSE_GONE;
  const spam = await spamCheck(user, formData, "campaign", parsed.data.target, parsed.data.ask);
  if (spam) return spam;
  await db.campaign.create({
    data: { ...parsed.data, creatorId: user.id, signatures: { create: { userId: user.id } } },
  });
  await refreshStage(parsed.data.causeId); // a campaign means Taking action
  refresh();
  return { ok: true };
}

const signSchema = z.object({
  campaignId: id,
  note: z.string().trim().max(500).optional(),
});

export async function signCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const campaign = await db.campaign.findUnique({ where: { id: parsed.data.campaignId }, select: { causeId: true } });
  if (!campaign) return { error: "That campaign no longer exists." };
  const user = await requireUser(`/causes/${campaign.causeId}`);
  // Signature counts go to decision-makers, so each one must be a confirmed person.
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const links = linkError(user, parsed.data.note);
  if (links) return { error: links };
  await db.signature.upsert({
    where: { campaignId_userId: { campaignId: parsed.data.campaignId, userId: user.id } },
    create: { campaignId: parsed.data.campaignId, userId: user.id, note: parsed.data.note || null },
    update: { note: parsed.data.note || null },
  });
  refresh();
  return { ok: true };
}

export async function unsignCampaign(formData: FormData) {
  const campaignId = id.parse(formData.get("campaignId"));
  const user = await requireUser();
  await db.signature.deleteMany({ where: { campaignId, userId: user.id } });
  refresh();
}

// ---------- Moderation ----------

export async function reportContent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.emailVerified) return;
  if (!(await rateLimit(`report:${user.id}`, 20, HOUR))) return;
  const parsed = z
    .object({ targetType: z.enum(["cause", "comment"]), targetId: id, reason: z.string().trim().max(300).default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId, reason } = parsed.data;

  // Nothing to report if it doesn't exist or a moderator already removed it.
  const target =
    targetType === "cause"
      ? await db.cause.findUnique({ where: { id: targetId }, select: { removedAt: true } })
      : await db.comment.findUnique({ where: { id: targetId }, select: { removedAt: true, causeId: true } });
  if (!target || target.removedAt) return;

  await db.report.upsert({
    where: { targetType_targetId_reporterId: { targetType, targetId, reporterId: user.id } },
    create: { targetType, targetId, reason, reporterId: user.id },
    update: {},
  });

  // Auto-hide after several independent reports, pending human review. Only
  // established accounts (older than a day) count, so a handful of throwaway
  // accounts can't silence someone.
  const count = await db.report.count({
    where: {
      targetType,
      targetId,
      resolved: false,
      reporter: { createdAt: { lt: new Date(Date.now() - ESTABLISHED_ACCOUNT_MS) } },
    },
  });
  if (shouldAutoHide(count)) {
    if (targetType === "cause") await db.cause.update({ where: { id: targetId }, data: { hidden: true } });
    else await db.comment.update({ where: { id: targetId }, data: { hidden: true } });
    announceChatChange("causeId" in target ? (target.causeId as string) : targetId);
  }
  refresh();
}

export async function setHomeArea(formData: FormData) {
  const user = await requireUser();
  const p = parsePostal(String(formData.get("country") ?? ""), String(formData.get("postal") ?? ""));
  if (!p.ok) return;
  await db.user.update({ where: { id: user.id }, data: { homeCountry: p.country.code, homePostal: p.postal } });
  refresh();
}
