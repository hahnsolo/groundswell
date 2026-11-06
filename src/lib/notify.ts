import "server-only";
import { db } from "./db";
import { appUrl, sendEmail } from "./mail";
import {
  budgetLeft,
  checkUnsubscribe,
  digestSince,
  noticeRow,
  NOTIFICATION_EMAILS,
  NOTIFICATION_KEEP_DAYS,
  prefsOff,
  NOTIFY_KINDS,
  reminderWindow,
  startOfBudgetDay,
  unsubscribeToken,
  wants,
  type AlwaysKind,
  type NoticeKind,
  type NotifyKind,
} from "./notify-rules";
import { flyerWhen } from "./share-meta";
import { sendPush } from "./push";
import { chooseChannel, pushMessage } from "./push-rules";

// Telling people things (#18, #72, #95). Everything goes through deliver(): a
// notification in their list on the site, plus push where they have it on.
// Email is only for confirming sign-up and password resets (see NOTIFICATION_EMAILS).

const PREFS = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  deactivatedAt: true,
  notifyEvents: true,
  notifyWinCheck: true,
  notifyWins: true,
  notifyNewMembers: true,
  notifyChatDigest: true,
  notifyAnnouncements: true,
} as const;

type Recipient = { id: string; name: string; email: string };

const secret = () => process.env.BETTER_AUTH_SECRET ?? "";

/** The page link in the email footer: shows what it turns off, with a button (link scanners don't press buttons). */
export function unsubscribeUrl(userId: string, kind: NotifyKind | "all", path = "/unsubscribe") {
  const qs = new URLSearchParams({ u: userId, k: kind, t: unsubscribeToken(userId, kind, secret()) });
  return appUrl(`${path}?${qs}`);
}

/** Turns off a kind for someone if the link is genuine. Returns whether it did. */
export async function unsubscribe(userId: string, kind: string, token: string) {
  if (!checkUnsubscribe(userId, kind, token, secret())) return false;
  await db.user.updateMany({ where: { id: userId }, data: prefsOff(kind as NotifyKind | "all") });
  return true;
}

/**
 * Tells a group of people the same thing. Everyone's notification is saved
 * first, in one go, so a slow push service or a timeout can't lose anyone's.
 * Returns how each person was reached.
 */
async function deliver<P extends Recipient>(people: P[], kind: NoticeKind, title: string, body: string, url: string, sourceId?: string) {
  if (people.length === 0) return [];
  const message = pushMessage(title, body, url);
  await db.notification.createMany({ data: people.map((p) => noticeRow(p.id, kind, message, sourceId)) });
  const reached: { person: P; channel: "push" | "site" }[] = [];
  for (const person of people) {
    let channel: "push" | "site" = "site";
    try {
      const { devices, delivered } = await sendPush(person.id, message);
      if (chooseChannel(devices, delivered) === "push") channel = "push";
    } catch (e) {
      console.warn("Push failed:", (e as Error).message); // it's in their list either way
    }
    if (channel === "site" && NOTIFICATION_EMAILS && kind in NOTIFY_KINDS) await emailNotice(person, kind as NotifyKind, title, body);
    reached.push({ person, channel });
  }
  return reached;
}

/** Something about you that needs to reach you whatever your settings: a request to lead, a removal… */
export async function notifyAlways(userId: string, kind: AlwaysKind, title: string, body: string, url: string) {
  const person = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, deactivatedAt: true } });
  if (!person || person.deactivatedAt) return;
  await deliver([person], kind, title, body, url);
}

/** Emails one notification if today's budget allows. Off for now (NOTIFICATION_EMAILS). */
async function emailNotice(to: Recipient, kind: NotifyKind, subject: string, body: string) {
  const sentToday = await db.notificationLog.count({ where: { createdAt: { gte: startOfBudgetDay() } } });
  if (budgetLeft(sentToday) === 0) {
    console.warn(`Notification budget reached for today; skipped a "${kind}" email.`);
    return false;
  }
  const off = unsubscribeUrl(to.id, kind);
  const text =
    `Hi ${to.name},\n\n${body}\n\n—\n` +
    `You're getting this because of your Groundswell email settings: ${appUrl("/me#email")}\n` +
    `Stop ${NOTIFY_KINDS[kind].label} emails: ${off}\n` +
    `Stop all notification emails: ${unsubscribeUrl(to.id, "all")}`;
  try {
    await sendEmail({
      to: to.email,
      subject,
      text,
      // One-click unsubscribe in mail apps (RFC 8058).
      headers: { "List-Unsubscribe": `<${unsubscribeUrl(to.id, kind, "/api/unsubscribe")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
  } catch (e) {
    console.warn(`Notification email failed (${kind}):`, (e as Error).message);
    return false;
  }
  await db.notificationLog.create({ data: { userId: to.id, kind } });
  return true;
}

/** Members of a cause who want this kind of notification about it. */
async function membersWanting(causeId: string, kind: NotifyKind, exceptUserId?: string) {
  const members = await db.causeMember.findMany({
    where: { causeId, ...(exceptUserId && { userId: { not: exceptUserId } }) },
    select: { muted: true, user: { select: PREFS } },
  });
  return members.filter((m) => wants(m.user, kind, m.muted)).map((m) => m.user);
}

// ---------- Right away ----------

/** A leader asked members to confirm a win: "Is it fixed?" */
export async function notifyWinCheck(causeId: string, proposerId: string) {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { title: true, winProposals: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 1, include: { proposedBy: { select: { name: true } } } } } });
  const proposal = cause?.winProposals[0];
  if (!cause || !proposal) return 0;
  const people = await membersWanting(causeId, "win_check", proposerId);
  const reached = await deliver(people, "win_check", `Is it fixed? "${cause.title}"`, `${proposal.proposedBy.name} says it's fixed: "${proposal.note}" Confirm it within 7 days.`, `/causes/${causeId}#win`);
  return reached.length;
}

/** Members confirmed the win. */
export async function notifyWon(causeId: string) {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { title: true } });
  if (!cause) return 0;
  const people = await membersWanting(causeId, "won");
  const reached = await deliver(people, "won", `Won: "${cause.title}" 🎉`, "Members confirmed it. Thanks for being part of it.", `/causes/${causeId}`);
  return reached.length;
}

/** A host cancelled a meeting of a series, or the rest of them (#78): everyone going hears. Muting or turning off reminders stops it. */
export async function notifyCancelled({ causeId, title, userIds, all, startsAt }: { causeId: string; title: string; userIds: string[]; all: boolean; startsAt: Date }) {
  if (userIds.length === 0) return 0;
  const [people, muted, cause] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: PREFS }),
    db.causeMember.findMany({ where: { causeId, muted: true, userId: { in: userIds } }, select: { userId: true } }),
    db.cause.findUnique({ where: { id: causeId }, select: { country: true, region: true } }),
  ]);
  const mutedIds = new Set(muted.map((m) => m.userId));
  // In the place's own time zone, as on flyers: we don't know theirs.
  const day = cause ? flyerWhen(startsAt, startsAt, cause.country, cause.region).day : "";
  const what = all ? `All the remaining "${title}" meetings, from ${day}, have been cancelled.` : `The "${title}" meeting on ${day} has been cancelled.`;
  const wanting = people.filter((p) => wants(p, "event_tomorrow", mutedIds.has(p.id)));
  const reached = await deliver(wanting, "event_tomorrow", `Cancelled: ${title}`, what, `/causes/${causeId}/events`);
  return reached.length;
}

/** An announcement was posted (#73): in everyone's list, and by push where it's on. Muting or the setting stops both. */
export async function notifyAnnouncement(announcementId: string) {
  const a = await db.announcement.findUnique({
    where: { id: announcementId },
    select: { body: true, authorId: true, causeId: true, cause: { select: { title: true } } },
  });
  if (!a) return 0;
  const people = await membersWanting(a.causeId, "announcement", a.authorId);
  const reached = await deliver(people, "announcement", `News from "${a.cause.title}"`, a.body, `/causes/${a.causeId}/chat`, announcementId);
  return reached.length;
}

/** Something was taken down: its words shouldn't stay in anyone's notifications (#97). */
export async function withdrawNotices(sourceId: string) {
  await db.notification.deleteMany({ where: { sourceId } });
}

// ---------- Daily (from the daily job) ----------

/** The day before: everyone going to an event, once per event. */
export async function sendEventReminders(now = new Date()) {
  const { from, to } = reminderWindow(now);
  const events = await db.meetup.findMany({
    where: { reminderSentAt: null, startsAt: { gte: from, lt: to }, cause: { removedAt: null } },
    select: { id: true, causeId: true, title: true, location: true, isOnline: true, rsvps: { select: { user: { select: PREFS } } } },
    take: 200,
  });
  const reminded: { email: string; event: string; channel: "push" | "site" }[] = [];
  for (const e of events) {
    const muted = new Set(
      (await db.causeMember.findMany({ where: { causeId: e.causeId, muted: true }, select: { userId: true } })).map((m) => m.userId),
    );
    // Mark first, so a failure part-way never tells anyone twice.
    await db.meetup.update({ where: { id: e.id }, data: { reminderSentAt: now } });
    const wanting = e.rsvps.map((r) => r.user).filter((u) => wants(u, "event_tomorrow", muted.has(u.id)));
    const where = e.isOnline ? "Online (the link is on the event page)" : e.location;
    // No time here: we don't know their time zone, and the event page shows it in theirs.
    const reached = await deliver(wanting, "event_tomorrow", `Tomorrow: ${e.title}`, `You're going to "${e.title}" tomorrow. Where: ${where}`, `/events/${e.id}`);
    for (const r of reached) reminded.push({ email: r.person.email, event: e.title, channel: r.channel });
  }
  return reminded;
}

/** For leaders and co-leaders: who joined their causes in the last day. */
export async function sendNewMemberDigests(now = new Date()) {
  const since = digestSince(now);
  const joins = await db.causeMember.findMany({
    where: { createdAt: { gte: since }, cause: { removedAt: null, stage: { notIn: ["won", "closed"] } } },
    select: {
      userId: true,
      user: { select: { name: true, deactivatedAt: true } },
      cause: { select: { id: true, title: true, leaderId: true, coLeaders: { where: { acceptedAt: { not: null } }, select: { userId: true } } } },
    },
    take: 2000,
  });
  // leader id -> cause id -> names
  const byLeader = new Map<string, Map<string, { title: string; names: string[] }>>();
  for (const j of joins) {
    for (const leaderId of [j.cause.leaderId, ...j.cause.coLeaders.map((c) => c.userId)]) {
      if (leaderId === j.userId) continue;
      const causes = byLeader.get(leaderId) ?? new Map();
      const entry = causes.get(j.cause.id) ?? { title: j.cause.title, names: [] };
      entry.names.push(j.user.deactivatedAt ? "a neighbour" : j.user.name);
      causes.set(j.cause.id, entry);
      byLeader.set(leaderId, causes);
    }
  }
  let sent = 0;
  for (const [leaderId, causes] of byLeader) {
    const leader = await db.user.findUnique({ where: { id: leaderId }, select: PREFS });
    if (!leader) continue;
    const muted = new Set((await db.causeMember.findMany({ where: { userId: leaderId, muted: true }, select: { causeId: true } })).map((m) => m.causeId));
    const lines = [...causes].filter(([id]) => wants(leader, "new_members", muted.has(id)));
    if (lines.length === 0) continue;
    const total = lines.reduce((n, [, c]) => n + c.names.length, 0);
    const body = lines.map(([, c]) => `${c.title}: ${c.names.join(", ")}.`).join(" ");
    const url = lines.length === 1 ? `/causes/${lines[0][0]}#members` : "/me";
    sent += (await deliver([leader], "new_members", `${total} new member${total === 1 ? "" : "s"} joined your cause${lines.length === 1 ? "" : "s"}`, body, url)).length;
  }
  return sent;
}

/** For members who chose it: new chat messages in their causes in the last day. */
export async function sendChatDigests(now = new Date()) {
  const since = digestSince(now);
  const people = await db.user.findMany({ where: { notifyChatDigest: true, deactivatedAt: null }, select: PREFS, take: 500 });
  let sent = 0;
  for (const p of people) {
    const memberships = await db.causeMember.findMany({ where: { userId: p.id, muted: false, cause: { removedAt: null } }, select: { cause: { select: { id: true, title: true } } } });
    const lines: string[] = [];
    let onlyChat = "/me";
    for (const { cause } of memberships) {
      const count = await db.comment.count({ where: { causeId: cause.id, createdAt: { gte: since }, authorId: { not: p.id }, hidden: false, removedAt: null } });
      if (count > 0) {
        lines.push(`${cause.title}: ${count} new message${count === 1 ? "" : "s"}.`);
        onlyChat = lines.length === 1 ? `/causes/${cause.id}/chat` : "/me";
      }
    }
    if (lines.length === 0) continue;
    sent += (await deliver([p], "chat_digest", "New messages in your causes", lines.join(" "), onlyChat)).length;
  }
  return sent;
}

/** Clears what's no longer needed: old notifications, and the email log (only today's rows count toward the budget). */
export async function pruneNotificationLog(now = new Date()) {
  const [log, notices] = await Promise.all([
    db.notificationLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }),
    db.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_KEEP_DAYS * 24 * 60 * 60 * 1000) } } }),
  ]);
  return log.count + notices.count;
}
