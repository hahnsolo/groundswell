import "server-only";

export type Email = { to: string; subject: string; text: string; html?: string };

/**
 * Send a transactional email. With RESEND_API_KEY set it goes through Resend;
 * otherwise (local dev) it's printed to the server console so you can click
 * the links. To use another provider, change only this function.
 */
export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set — emails can't be sent in production.");
    }
    console.log(`\n📧 [dev email] To: ${email.to}\n   Subject: ${email.subject}\n\n${email.text}\n`);
    return;
  }

  const from = (process.env.MAIL_FROM ?? "").trim();
  // "Name <a@b.c>" or "a@b.c" — a typo here otherwise surfaces only as a vague 422 from Resend.
  if (!/^([^<>]+<[^<>\s@]+@[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+)$/.test(from)) {
    console.error(`MAIL_FROM is missing or malformed: "${from}". Expected e.g. "Groundswell <no-reply@yourdomain.org>".`);
    throw new Error("We couldn't send the email. Please try again shortly.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    console.error("Email send failed", res.status, await res.text().catch(() => ""));
    throw new Error("We couldn't send the email. Please try again shortly.");
  }
}

export function appUrl(path: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}
