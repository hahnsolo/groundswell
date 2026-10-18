"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser, UNVERIFIED_ERROR } from "@/lib/auth";
import { CATEGORY_IDS } from "@/lib/categories";
import { parsePostal } from "@/lib/countries";
import { resolvePlace } from "@/lib/places";
import { rateLimit } from "@/lib/rate-limit";
import { fromZodError, type FormState } from "@/lib/forms";

const id = z.string().min(1).max(40);

// Per-user write throttle, so one account can't flood an area.
function throttle(userId: string, kind: string, limit = 30) {
  return rateLimit(`${kind}:${userId}`, limit, 60 * 60 * 1000);
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
  if (!throttle(user.id, "issue", 10)) return { error: "You've posted a lot of issues this hour. Try again later." };

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
  if (!throttle(user.id, "comment", 60)) return { error: "Slow down a little — try again shortly." };
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
  if (parsed.data.startsAt.getTime() < Date.now()) {
    return { fieldErrors: { startsAt: ["Pick a time in the future."] } };
  }
  if (!throttle(user.id, "meetup", 10)) return { error: "You've created several meetups this hour. Try again later." };
  const { isOnline, ...data } = parsed.data;
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
    select: { issueId: true, capacity: true, _count: { select: { rsvps: true } } },
  });
  if (!meetup) return;
  const user = await requireUser(`/issues/${meetup.issueId}`);
  const key = { meetupId_userId: { meetupId, userId: user.id } };
  const existing = await db.rsvp.findUnique({ where: key });
  if (existing) await db.rsvp.delete({ where: key });
  else if (!meetup.capacity || meetup._count.rsvps < meetup.capacity) {
    await db.rsvp.create({ data: { meetupId, userId: user.id } });
  }
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
  if (!throttle(user.id, "campaign", 5)) return { error: "Try again later." };
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
  await db.signature.upsert({
    where: { campaignId_userId: { campaignId: parsed.data.campaignId, userId: user.id } },
    create: { campaignId: parsed.data.campaignId, userId: user.id, note: parsed.data.note || null },
    update: { note: parsed.data.note || null },
  });
  refresh();
  return { ok: true };
}

// ---------- Moderation ----------

const REPORTS_TO_HIDE = 3;

export async function reportContent(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = z
    .object({ targetType: z.enum(["issue", "comment"]), targetId: id, reason: z.string().trim().max(300).default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { targetType, targetId, reason } = parsed.data;

  await db.report.upsert({
    where: { targetType_targetId_reporterId: { targetType, targetId, reporterId: user.id } },
    create: { targetType, targetId, reason, reporterId: user.id },
    update: {},
  });

  // Auto-hide after several independent reports, pending human review.
  const count = await db.report.count({ where: { targetType, targetId, resolved: false } });
  if (count >= REPORTS_TO_HIDE) {
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
