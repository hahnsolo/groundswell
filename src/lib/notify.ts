import "server-only";
import { db } from "./db";
import { appUrl, sendEmail } from "./mail";
import {
  budgetLeft,
  checkUnsubscribe,
  digestSince,
  prefsOff,
  NOTIFY_KINDS,
  reminderWindow,
  startOfBudgetDay,
  unsubscribeToken,
  wants,
  type NotifyKind,
} from "./notify-rules";
import { sendPush } from "./push";
import { chooseChannel, pushMessage } from "./push-rules";

// Sending notifications (#18, #72). Every one goes through notify(): push where
// someone has it on, otherwise email, which keeps to the daily budget, adds the
// unsubscribe links and logs the send.

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
 * Tells one person: by push where they have it on (#72), which costs nothing,
 * otherwise by email if today's budget allows. Returns how it went, or false.
 * `url` is where tapping the notification goes.
 */
export async function notify(to: Recipient, kind: NotifyKind, subject: string, body: string, url = "/me"): Promise<false | "push" | "email"> {
  const { devices, delivered } = await sendPush(to.id, pushMessage(subject, body, url));
  if (chooseChannel(devices, delivered) === "push") return "push";

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
  return "email";
}

/** Members of a cause who want this kind of email about it. */
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
  let sent = 0;
  for (const m of await membersWanting(causeId, "win_check", proposerId)) {
    const ok = await notify(
      m,
      "win_check",
      `Is it fixed? "${cause.title}"`,
      `${proposal.proposedBy.name} says "${cause.title}" is fixed: "${proposal.note}"\n\nIf you agree, confirm it on the cause (it's open for 7 days):\n${appUrl(`/causes/${causeId}#win`)}`,
      `/causes/${causeId}#win`,
    );
    if (ok) sent++;
  }
  return sent;
}

/** Members confirmed the win. */
export async function notifyWon(causeId: string) {
  const cause = await db.cause.findUnique({ where: { id: causeId }, select: { title: true } });
  if (!cause) return 0;
  let sent = 0;
  for (const m of await membersWanting(causeId, "won")) {
    const ok = await notify(m, "won", `Won: "${cause.title}" 🎉`, `Members confirmed it: "${cause.title}" is won. Thanks for being part of it.\n\n${appUrl(`/causes/${causeId}`)}`, `/causes/${causeId}`);
    if (ok) sent++;
  }
  return sent;
}

// ---------- Daily (from the daily job, in this order, so reminders come first) ----------

/** The day before: everyone going to an event, once per event. */
export async function sendEventReminders(now = new Date()) {
  const { from, to } = reminderWindow(now);
  const events = await db.meetup.findMany({
    where: { reminderSentAt: null, startsAt: { gte: from, lt: to }, cause: { removedAt: null } },
    select: { id: true, causeId: true, title: true, startsAt: true, location: true, isOnline: true, rsvps: { select: { user: { select: PREFS } } } },
    take: 200,
  });
  const reminded: { email: string; event: string; channel: "push" | "email" }[] = [];
  for (const e of events) {
    const muted = new Set(
      (await db.causeMember.findMany({ where: { causeId: e.causeId, muted: true }, select: { userId: true } })).map((m) => m.userId),
    );
    // Mark first, so a failure part-way never sends anyone a second reminder.
    await db.meetup.update({ where: { id: e.id }, data: { reminderSentAt: now } });
    for (const { user } of e.rsvps) {
      if (!wants(user, "event_tomorrow", muted.has(user.id))) continue;
      const where = e.isOnline ? "Online (the link is on the event page)" : e.location;
      // No time in the email: we don't know their time zone, and the event page shows it in theirs.
      const ok = await notify(user, "event_tomorrow", `Tomorrow: ${e.title}`, `A reminder that you're going to "${e.title}" tomorrow.\nWhere: ${where}\n\nThe time, the details, or to say you can't make it:\n${appUrl(`/events/${e.id}`)}`, `/events/${e.id}`);
      if (ok) reminded.push({ email: user.email, event: e.title, channel: ok });
    }
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
    const body = lines.map(([id, c]) => `${c.title}: ${c.names.join(", ")}\n${appUrl(`/causes/${id}`)}`).join("\n\n");
    if (await notify(leader, "new_members", `${total} new member${total === 1 ? "" : "s"} joined your cause${lines.length === 1 ? "" : "s"}`, `In the last day:\n\n${body}\n\nA welcome in the chat goes a long way.`, lines.length === 1 ? `/causes/${lines[0][0]}#members` : "/me")) sent++;
  }
  return sent;
}

/** For members who chose it: new chat messages in their causes in the last day. */
export async function sendChatDigests(now = new Date()) {
  const since = digestSince(now);
  const people = await db.user.findMany({ where: { notifyChatDigest: true, deactivatedAt: null, emailVerified: true }, select: PREFS, take: 500 });
  let sent = 0;
  for (const p of people) {
    const memberships = await db.causeMember.findMany({ where: { userId: p.id, muted: false, cause: { removedAt: null } }, select: { cause: { select: { id: true, title: true } } } });
    const lines: string[] = [];
    let onlyChat = "/me";
    for (const { cause } of memberships) {
      const count = await db.comment.count({ where: { causeId: cause.id, createdAt: { gte: since }, authorId: { not: p.id }, hidden: false, removedAt: null } });
      if (count > 0) {
        lines.push(`${cause.title}: ${count} new message${count === 1 ? "" : "s"}\n${appUrl(`/causes/${cause.id}/chat`)}`);
        onlyChat = lines.length === 1 ? `/causes/${cause.id}/chat` : "/me";
      }
    }
    if (lines.length === 0) continue;
    if (await notify(p, "chat_digest", "New messages in your causes", `In the last day:\n\n${lines.join("\n\n")}`, onlyChat)) sent++;
  }
  return sent;
}

/** The log only needs today's rows (for the budget); keep a week for checking. */
export async function pruneNotificationLog(now = new Date()) {
  const { count } = await db.notificationLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } });
  return count;
}
