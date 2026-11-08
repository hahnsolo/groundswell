// How an email gets out: each service set up is tried in turn, so running out of
// one free allowance moves on to the next (#105). Kept free of server-only imports
// so it can be tested directly. src/lib/mail.ts is what the site calls.

export type Email = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };

export type MailFrom = { address: string; name?: string };

export type MailService = {
  name: string;
  /** Free emails per day, to size the daily catch-up. */
  dailyAllowance: number;
  send: (email: Email, from: string) => Promise<Response>;
};

const TIMEOUT_MS = 8000;

/** "Name <a@b.c>" or "a@b.c". A typo here otherwise shows up only as a vague error from the service. */
export function parseMailFrom(from: string): MailFrom | null {
  const trimmed = from.trim();
  const named = /^([^<>]+)<([^<>\s@]+@[^<>\s@]+)>$/.exec(trimmed);
  if (named) return { name: named[1].trim(), address: named[2] };
  return /^[^<>\s@]+@[^<>\s@]+$/.test(trimmed) ? { address: trimmed } : null;
}

function brevo(apiKey: string, doFetch: typeof fetch): MailService {
  return {
    name: "Brevo",
    dailyAllowance: 300,
    send: (email, from) => {
      const sender = parseMailFrom(from)!;
      return doFetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: sender.address, ...(sender.name && { name: sender.name }) },
          to: [{ email: email.to }],
          subject: email.subject,
          textContent: email.text,
          ...(email.html && { htmlContent: email.html }),
          ...(email.headers && { headers: email.headers }),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    },
  };
}

function resend(apiKey: string, doFetch: typeof fetch): MailService {
  return {
    name: "Resend",
    dailyAllowance: 100,
    send: (email, from) =>
      doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text, html: email.html, headers: email.headers }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
  };
}

/** The services set up, in the order to try them. Brevo first: it has the bigger free allowance. */
export function mailServices(env: Record<string, string | undefined>, doFetch: typeof fetch = fetch): MailService[] {
  return [
    ...(env.BREVO_API_KEY ? [brevo(env.BREVO_API_KEY, doFetch)] : []),
    ...(env.RESEND_API_KEY ? [resend(env.RESEND_API_KEY, doFetch)] : []),
  ];
}

export const COULD_NOT_SEND = "We couldn't send the email. Please try again shortly.";

/** Tries each service until one takes the email. Throws if none does. */
export async function deliver(email: Email, services: MailService[], from: string): Promise<string> {
  for (const service of services) {
    try {
      const res = await service.send(email, from);
      if (res.ok) return service.name;
      console.error("Email send failed", service.name, res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("Email send failed", service.name, e instanceof Error ? e.message : "unknown error");
    }
  }
  throw new Error(COULD_NOT_SEND);
}

/**
 * How many delayed confirmations the daily job may send: half of the day's free
 * allowance, so the rest stays free for password resets and new sign-ups.
 */
export function catchUpLimit(services: MailService[]) {
  return Math.floor(services.reduce((total, s) => total + s.dailyAllowance, 0) / 2);
}
