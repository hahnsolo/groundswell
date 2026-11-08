import "server-only";
import { COULD_NOT_SEND, deliver, mailServices, parseMailFrom, type Email } from "./mail-send";

export type { Email };

/**
 * Send a transactional email, through Brevo and then Resend if Brevo fails
 * (whichever have keys set; src/lib/mail-send.ts). With neither (local dev) it's
 * printed to the server console so you can click the links.
 */
export async function sendEmail(email: Email) {
  const services = mailServices(process.env);
  if (services.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY and RESEND_API_KEY are not set — emails can't be sent in production.");
    }
    console.log(`\n📧 [dev email] To: ${email.to}\n   Subject: ${email.subject}\n\n${email.text}\n`);
    return;
  }

  const from = (process.env.MAIL_FROM ?? "").trim();
  if (!parseMailFrom(from)) {
    console.error(`MAIL_FROM is missing or malformed: "${from}". Expected e.g. "Groundswell <no-reply@yourdomain.org>".`);
    throw new Error(COULD_NOT_SEND);
  }

  await deliver(email, services, from);
}

export function appUrl(path: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}
