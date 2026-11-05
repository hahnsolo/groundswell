import { createHmac, timingSafeEqual } from "node:crypto";

// Notification emails (#18): which kinds there are, who wants which, when
// reminders go out, and the daily budget. Pure, so it's easy to test; the
// sending is in ./notify.ts.

export const NOTIFY_KINDS = {
  event_tomorrow: { pref: "notifyEvents", label: "Event reminders", hint: "The day before an event you're going to" },
  win_check: { pref: "notifyWinCheck", label: "“Is it fixed?”", hint: "When a leader asks members to confirm a win" },
  won: { pref: "notifyWins", label: "Wins", hint: "When a cause you joined is won" },
  new_members: { pref: "notifyNewMembers", label: "New members", hint: "Daily, for causes you lead: who joined" },
  chat_digest: { pref: "notifyChatDigest", label: "Chat summary", hint: "Daily: new messages in your causes" },
} as const;

export type NotifyKind = keyof typeof NOTIFY_KINDS;
export type NotifyPref = (typeof NOTIFY_KINDS)[NotifyKind]["pref"];
export type NotifyPrefs = Record<NotifyPref, boolean>;
export const NOTIFY_KIND_IDS = Object.keys(NOTIFY_KINDS) as NotifyKind[];

export const isNotifyKind = (k: string): k is NotifyKind => k in NOTIFY_KINDS;

/**
 * Resend's free plan sends 100 emails a day. Notifications get 60 of them, so
 * sign-in, password and confirmation emails always have room. Past the budget,
 * notifications are skipped (and logged) until tomorrow, never queued.
 */
export const DAILY_NOTIFY_BUDGET = 60;

export function budgetLeft(sentToday: number) {
  return Math.max(0, DAILY_NOTIFY_BUDGET - sentToday);
}

/** Midnight UTC today: the budget resets then, like Resend's. */
export function startOfBudgetDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whether this person wants this email about this cause. Deactivated accounts get nothing. */
export function wants(
  user: NotifyPrefs & { deactivatedAt?: Date | null; emailVerified?: boolean },
  kind: NotifyKind,
  muted = false,
) {
  if (user.deactivatedAt || user.emailVerified === false || muted) return false;
  return user[NOTIFY_KINDS[kind].pref];
}

const HOUR = 60 * 60 * 1000;

/**
 * The daily job (09:00 UTC) reminds people about events starting 12 to 36 hours
 * from now: "tomorrow" in North American time zones, and each event once.
 */
export function reminderWindow(now = new Date()) {
  return { from: new Date(now.getTime() + 12 * HOUR), to: new Date(now.getTime() + 36 * HOUR) };
}

/** The daily summaries cover the last 24 hours. */
export function digestSince(now = new Date()) {
  return new Date(now.getTime() - 24 * HOUR);
}

// ---------- Unsubscribe links ----------
// Signed, so nobody can turn off someone else's emails by guessing a link.
// "all" turns every notification off.

export type UnsubscribeKind = NotifyKind | "all";

function sign(userId: string, kind: UnsubscribeKind, secret: string) {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}:${kind}`).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(userId: string, kind: UnsubscribeKind, secret: string) {
  return sign(userId, kind, secret);
}

export function checkUnsubscribe(userId: string, kind: string, token: string, secret: string) {
  if (!secret || !userId || !(kind === "all" || isNotifyKind(kind))) return false;
  const expected = Buffer.from(sign(userId, kind, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** What turning a kind off sets on the user. */
export function prefsOff(kind: UnsubscribeKind): Partial<NotifyPrefs> {
  if (kind !== "all") return { [NOTIFY_KINDS[kind].pref]: false };
  return Object.fromEntries(NOTIFY_KIND_IDS.map((k) => [NOTIFY_KINDS[k].pref, false]));
}
