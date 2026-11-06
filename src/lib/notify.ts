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
import { buildBundles, NOTICE_EXPIRES_DAYS, splitByBudget } from "./announcements";
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
 * Tells one person: by push where they have it on (#72), which costs nothing,
 * otherwise by email if today's budget allows. Returns how it went, or false.
 * `url` is where tapping the notification goes.
 */
export async function notify(to: Recipient, kind: NotifyKind, subject: string, body: string, url = "/me"): Promise<false | "push" | "email"> {
  const { devices, delivered } = await sendPush(to.id, pushMessage(subject, body, url));
  if (chooseChannel(devices, delivered) === "push") return "push";
  return (await emailNotice(to, kind, subject, body)) ? "email" : false;
}

/** Pushes to someone's devices only. Whether it reached one. */
async function pushOnly(to: Recipient, subject: string, body: string, url: string) {
  const { devices, delivered } = await sendPush(to.id, pushMessage(subject, body, url));
  return chooseChannel(devices, delivered) === "push";
}

/** Emails one notification if today's budget allows. Returns whether it went. */
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

/**
 * An announcement was posted (#73). Whoever has push on hears now; everyone else
 * gets it in their one daily email. Muting or the setting stops both.
 */
export async function notifyAnnouncement(announcementId: string) {
  const a = await db.announcement.findUnique({
    where: { id: announcementId },
    select: { body: true, authorId: true, causeId: true, cause: { select: { title: true } } },
  });
  if (!a) return 0;
  const people = await membersWanting(a.causeId, "announcement", a.authorId);
  const subject = `News from "${a.cause.title}"`;
  let pushed = 0;
  for (const person of people) {
    const ok = await pushOnly(person, subject, a.body, `/causes/${a.causeId}/chat`);
    if (ok) pushed++;
    await db.announcementNotice.create({ data: { announcementId, userId: person.id, ...(ok ? { via: "push", sentAt: new Date() } : {}) } });
  }
  return pushed;
}

/**
 * The daily email (#73): one per person, bundling tomorrow's events with any
 * announcements waiting for them. Runs first in the daily job, so reminders get
 * the budget before summaries. Announcements past the budget stay unsent and
 * go the next morning. Reminders reach people with push on individually.
 */
export async function sendDailyBundles(now = new Date()) {
  const { from, to } = reminderWindow(now);
  const events = await db.meetup.findMany({
    where: { reminderSentAt: null, startsAt: { gte: from, lt: to }, cause: { removedAt: null } },
    select: { id: true, causeId: true, title: true, startsAt: true, location: true, isOnline: true, rsvps: { select: { user: { select: PREFS } } } },
    take: 200,
  });
  const reminded: { email: string; event: string; channel: "push" | "email" }[] = [];
  type Person = (typeof events)[number]["rsvps"][number]["user"];
  const forEmail: { user: Person; reminder: { event: string; text: string } }[] = [];
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
      const text = `A reminder that you're going to "${e.title}" tomorrow.\nWhere: ${where}\n\nThe time, the details, or to say you can't make it:\n${appUrl(`/events/${e.id}`)}`;
      if (await pushOnly(user, `Tomorrow: ${e.title}`, text, `/events/${e.id}`)) reminded.push({ email: user.email, event: e.title, channel: "push" });
      else forEmail.push({ user, reminder: { event: e.title, text } });
    }
  }

  // Announcements still waiting, unless the person has since turned them off or muted the cause.
  const waiting = await db.announcementNotice.findMany({
    where: { sentAt: null, announcement: { createdAt: { gte: new Date(now.getTime() - NOTICE_EXPIRES_DAYS * 24 * 60 * 60 * 1000) }, cause: { removedAt: null } } },
    select: {
      user: { select: PREFS },
      announcement: { select: { id: true, body: true, createdAt: true, causeId: true, cause: { select: { title: true } }, author: { select: { name: true, deactivatedAt: true } } } },
    },
    take: 5000,
  });
  const mutes = await db.causeMember.findMany({ where: { muted: true, userId: { in: [...new Set(waiting.map((w) => w.user.id))] } }, select: { userId: true, causeId: true } });
  const mutedKeys = new Set(mutes.map((m) => `${m.userId}:${m.causeId}`));
  const wanted = waiting.filter((w) => wants(w.user, "announcement", mutedKeys.has(`${w.user.id}:${w.announcement.causeId}`)));

  const sentToday = await db.notificationLog.count({ where: { createdAt: { gte: startOfBudgetDay() } } });
  const { send, carry } = splitByBudget(buildBundles(forEmail, wanted), budgetLeft(sentToday));
  if (carry.length) console.warn(`Notification budget reached; ${carry.length} daily email(s) wait for tomorrow (announcements carry over).`);

  const announced: { email: string; announcements: number; reminders: number }[] = [];
  for (const { user, reminders, announcements } of send) {
    const news = announcements.map((a) => `News from "${a.cause.title}" (${a.author.deactivatedAt ? "the people leading it" : a.author.name}):\n\n${a.body}\n\n${appUrl(`/causes/${a.causeId}/chat`)}`);
    const body = [...news, ...reminders.map((r) => r.text)].join("\n\n— — —\n\n");
    const subject =
      announcements.length === 0
        ? reminders.length === 1
          ? `Tomorrow: ${reminders[0].event}`
          : `Tomorrow: ${reminders.length} events`
        : announcements.length === 1 && reminders.length === 0
          ? `News from "${announcements[0].cause.title}"`
          : "News from your causes";
    if (!(await emailNotice(user, announcements.length ? "announcement" : "event_tomorrow", subject, body))) continue;
    for (const r of reminders) reminded.push({ email: user.email, event: r.event, channel: "email" });
    if (announcements.length) {
      await db.announcementNotice.updateMany({ where: { userId: user.id, announcementId: { in: announcements.map((a) => a.id) } }, data: { via: "email", sentAt: now } });
      announced.push({ email: user.email, announcements: announcements.length, reminders: reminders.length });
    }
  }
  return { reminded, announced };
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
