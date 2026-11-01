"use server";

import { refresh } from "next/cache";
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

/** Comments, meetups and campaigns can only be added to causes a moderator hasn't removed. */
async function causeOpen(causeId: string) {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { removedAt: true } });
  return !!cause && !cause.removedAt;
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
      // The author obviously cares about it.
      members: { create: { userId: user.id } },
    },
  });
  redirect(`/causes/${cause.id}`);
}

export async function setCauseStatus(formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({ causeId: id, status: z.enum(["open", "in_progress", "resolved"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { causeId, status } = parsed.data;
  const where = { id: causeId, authorId: user.id };
  // Remember when it was won (first time only); clear it if reopened.
  if (status === "resolved") {
    await db.cause.updateMany({ where: { ...where, status: { not: "resolved" } }, data: { status, resolvedAt: new Date() } });
  } else {
    await db.cause.updateMany({ where, data: { status, resolvedAt: null } });
  }
  refresh();
}

/** The person who raised a cause can change who they think should fix it. */
export async function setCauseFixer(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ causeId: id, ...fixerFields }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (fixerOtherMissing(parsed.data)) return FIXER_OTHER_MISSING;
  const links = linkError(user, parsed.data.fixerOther);
  if (links) return { error: links };
  await db.cause.updateMany({ where: { id: parsed.data.causeId, authorId: user.id, removedAt: null }, data: fixerData(parsed.data) });
  refresh();
  return { ok: true };
}

export async function toggleMembership(formData: FormData) {
  const causeId = id.parse(formData.get("causeId"));
  const user = await requireUser(`/causes/${causeId}`);
  const key = { causeId_userId: { causeId, userId: user.id } };
  const existing = await db.causeMember.findUnique({ where: key });
  if (existing) await db.causeMember.delete({ where: key });
  else await db.causeMember.create({ data: { causeId, userId: user.id } });
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
    db.cause.findUnique({ where: { id: parsed.data.causeId }, select: { authorId: true } }),
    db.causeMember.findUnique({ where: { causeId_userId: { causeId: parsed.data.causeId, userId: user.id } }, select: { createdAt: true } }),
  ]);
  const access = chatAccess({
    signedIn: true,
    isAdmin: user.isAdmin,
    isAuthor: cause?.authorId === user.id,
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

// ---------- Meetups ----------

const meetupSchema = z.object({
  causeId: id,
  title: z.string().trim().min(4, "Add a title.").max(120),
  description: z.string().trim().max(3000).default(""),
  startsAt: z.coerce.date({ errorMap: () => ({ message: "Pick a date and time." }) }),
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
