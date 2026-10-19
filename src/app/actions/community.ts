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
import { handOverMeetup, leaveIssue } from "@/lib/leaving";
import { fromZodError, type FormState } from "@/lib/forms";

const id = z.string().min(1).max(40);

const LIMIT_MESSAGES = {
  issue: "You've posted a lot of issues this hour. Try again later.",
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

const ISSUE_GONE: FormState = { error: "This issue is no longer available." };

/** Comments, meetups and campaigns can only be added to issues a moderator hasn't removed. */
async function issueOpen(issueId: string) {
  const issue = await db.issue.findUnique({ where: { id: issueId }, select: { removedAt: true } });
  return !!issue && !issue.removedAt;
}

// ---------- Issues ----------

const issueSchema = z.object({
  country: z.string(),
  postal: z.string(),
  title: z.string().trim().min(8, "Give it a clear title (8+ characters).").max(120),
  description: z.string().trim().min(20, "Describe the issue in a sentence or two (20+ characters).").max(5000),
  category: z.enum(CATEGORY_IDS, { errorMap: () => ({ message: "Pick a category." }) }),
});

export async function createIssue(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const spam = await spamCheck(user, formData, "issue", parsed.data.title, parsed.data.description);
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

  const issue = await db.issue.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      country: place.country,
      postalCode: place.postalCode,
      placeName: place.placeName,
      region: place.regionCode,
      lat: place.lat,
      lng: place.lng,
      authorId: user.id,
      // The author obviously cares about it.
      supports: { create: { userId: user.id } },
    },
  });
  redirect(`/issues/${issue.id}`);
}

export async function setIssueStatus(formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({ issueId: id, status: z.enum(["open", "in_progress", "resolved"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.issue.updateMany({
    where: { id: parsed.data.issueId, authorId: user.id },
    data: { status: parsed.data.status },
  });
  refresh();
}

export async function toggleSupport(formData: FormData) {
  const issueId = id.parse(formData.get("issueId"));
  const user = await requireUser(`/issues/${issueId}`);
  const key = { issueId_userId: { issueId, userId: user.id } };
  const existing = await db.issueSupport.findUnique({ where: key });
  if (existing) await db.issueSupport.delete({ where: key });
  else await db.issueSupport.create({ data: { issueId, userId: user.id } });
  refresh();
}

// ---------- Discussion ----------

const commentSchema = z.object({
  issueId: id,
  body: z.string().trim().min(1, "Write something first.").max(3000),
});

export async function addComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await issueOpen(parsed.data.issueId))) return ISSUE_GONE;
  const spam = await spamCheck(user, formData, "comment", parsed.data.body);
  if (spam) return spam;
  // Same text posted again within 10 minutes is almost always a double-click or a bot.
  const duplicate = await db.comment.findFirst({
    where: { authorId: user.id, body: parsed.data.body, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (duplicate) return { error: "You just posted that." };
  await db.comment.create({ data: { ...parsed.data, authorId: user.id } });
  refresh();
  return { ok: true };
}

// ---------- Meetups ----------

const meetupSchema = z.object({
  issueId: id,
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
  if (!(await issueOpen(parsed.data.issueId))) return ISSUE_GONE;
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
  redirect(`/issues/${data.issueId}#meetup-${meetup.id}`);
}

export async function toggleRsvp(formData: FormData) {
  const meetupId = id.parse(formData.get("meetupId"));
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    select: { issueId: true, organizerId: true, capacity: true, _count: { select: { rsvps: true } } },
  });
  if (!meetup) return;
  const user = await requireUser(`/issues/${meetup.issueId}`);
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
  const meetup = await db.meetup.findUnique({ where: { id: meetupId }, select: { issueId: true, startsAt: true } });
  if (!meetup) return;
  const user = await requireUser(`/issues/${meetup.issueId}`);
  if (meetup.startsAt.getTime() <= Date.now()) return;
  await handOverMeetup(meetupId, user.id); // does nothing unless they're the host
  refresh();
}

// ---------- Leaving an issue ----------

/** Take back support, RSVPs and signatures on an issue in one go. Comments stay. */
export async function leaveIssueAction(formData: FormData) {
  const issueId = id.parse(formData.get("issueId"));
  const user = await requireUser(`/issues/${issueId}`);
  await leaveIssue(user.id, issueId);
  refresh();
}

// ---------- Advocacy ----------

const campaignSchema = z.object({
  issueId: id,
  target: z.string().trim().min(3, "Who needs to act? e.g. \"City Council\".").max(150),
  ask: z.string().trim().min(20, "Spell out exactly what you're asking for (20+ characters).").max(2000),
  goal: z.coerce.number().int().min(5).max(1_000_000).default(100),
});

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.emailVerified) return { error: UNVERIFIED_ERROR };
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await issueOpen(parsed.data.issueId))) return ISSUE_GONE;
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
  const campaign = await db.campaign.findUnique({ where: { id: parsed.data.campaignId }, select: { issueId: true } });
  if (!campaign) return { error: "That campaign no longer exists." };
  const user = await requireUser(`/issues/${campaign.issueId}`);
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
    .object({ targetType: z.enum(["issue", "comment"]), targetId: id, reason: z.string().trim().max(300).default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId, reason } = parsed.data;

  // Nothing to report if it doesn't exist or a moderator already removed it.
  const target =
    targetType === "issue"
      ? await db.issue.findUnique({ where: { id: targetId }, select: { removedAt: true } })
      : await db.comment.findUnique({ where: { id: targetId }, select: { removedAt: true } });
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
    if (targetType === "issue") await db.issue.update({ where: { id: targetId }, data: { hidden: true } });
    else await db.comment.update({ where: { id: targetId }, data: { hidden: true } });
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
