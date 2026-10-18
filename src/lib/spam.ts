import "server-only";
import { clientIp, HOUR, rateLimit } from "./rate-limit";
import type { CurrentUser } from "./auth";

// ---------- Bot check: Cloudflare Turnstile ----------
// Free and privacy-friendly; usually invisible to real people. Turned on by
// setting NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY. Off when unset
// (local dev), so nothing breaks before you've created the keys.

export const turnstileEnabled = !!process.env.TURNSTILE_SECRET_KEY;

if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !turnstileEnabled) {
  console.warn("⚠️  TURNSTILE_SECRET_KEY is not set — sign-up and sign-in have no bot protection.");
}

/** Checks the Turnstile token the widget added to the form. Fails closed. */
export async function verifyHuman(formData: FormData): Promise<boolean> {
  if (!turnstileEnabled) return true;
  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        remoteip: await clientIp(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed", err);
    return false;
  }
}

export const BOT_CHECK_ERROR = "We couldn't confirm you're human. Please try again.";

// ---------- Honeypot ----------
// A hidden "website" field real people never see or fill in; naive bots fill every field.

export const HONEYPOT_FIELD = "website";

export function honeypotTripped(formData: FormData) {
  const v = formData.get(HONEYPOT_FIELD);
  return typeof v === "string" && v.trim() !== "";
}

// ---------- Posting limits ----------
// Brand-new accounts (first 24h) get much tighter limits and can't post links:
// that's where almost all spam comes from, and real neighbours rarely notice.

type Kind = "issue" | "comment" | "meetup" | "campaign";

const LIMITS: Record<Kind, { perHour: number; newPerHour: number }> = {
  issue: { perHour: 10, newPerHour: 2 },
  comment: { perHour: 60, newPerHour: 10 },
  meetup: { perHour: 10, newPerHour: 2 },
  campaign: { perHour: 5, newPerHour: 1 },
};

const MAX_LINKS = 3;
const NEW_ACCOUNT_MS = 24 * HOUR;

function isNewAccount(user: CurrentUser) {
  return Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_MS;
}

/** Hourly posting allowance for this user and kind of post. */
export async function withinPostingLimit(user: CurrentUser, kind: Kind) {
  const { perHour, newPerHour } = LIMITS[kind];
  return rateLimit(`${kind}:${user.id}`, isNewAccount(user) ? newPerHour : perHour, HOUR);
}

const LINK_PATTERN = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

/** An error message if the text has more links than this user may post, else null. */
export function linkError(user: CurrentUser, ...texts: (string | null | undefined)[]) {
  const links = texts.reduce((n, t) => n + (t?.match(LINK_PATTERN)?.length ?? 0), 0);
  if (isNewAccount(user) && links > 0) return "New accounts can't post links for the first 24 hours.";
  if (links > MAX_LINKS) return `Please include at most ${MAX_LINKS} links.`;
  return null;
}
