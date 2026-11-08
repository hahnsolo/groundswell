import "server-only";
import { db } from "./db";
import { sendEmail } from "./mail";
import { catchUpLimit, mailServices } from "./mail-send";

// Confirmation emails that can't go out yet (#105). When the free allowance runs
// out, the account is marked with confirmEmailDueAt and the person carries on,
// able to read and join. The daily job sends them a fresh link later, so no link
// or token is ever stored waiting in the database.

/** Better Auth's sendVerificationEmail. Never throws: a failed email mustn't fail sign-up. */
export async function sendConfirmationEmail({ user, url }: { user: { id: string; name: string; email: string }; url: string }) {
  try {
    await sendEmail({
      to: user.email,
      subject: "Confirm your email for Groundswell",
      text: `Hi ${user.name},\n\nConfirm your email so you can start causes, chat and organize events:\n${url}\n\nThis link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
    });
    await db.user.updateMany({ where: { id: user.id, confirmEmailDueAt: { not: null } }, data: { confirmEmailDueAt: null } });
  } catch (e) {
    console.error("Confirmation email delayed", e instanceof Error ? e.message : "unknown error");
    await db.user.updateMany({ where: { id: user.id, confirmEmailDueAt: null }, data: { confirmEmailDueAt: new Date() } });
  }
}

/** Is this person still waiting for us to send their confirmation link? */
export async function confirmEmailDelayed(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { confirmEmailDueAt: true } });
  return !!user?.confirmEmailDueAt;
}

const AT_ONCE = 5;
const MAX_RUN_MS = 60_000;

/**
 * For the daily job: sends delayed confirmations, oldest first. Stops when sending
 * still fails, when it reaches its share of the day's allowance, or after a minute.
 * `send` is Better Auth's sendVerificationEmail, which comes back to sendConfirmationEmail.
 */
export async function sendDelayedConfirmations(send: (email: string) => Promise<unknown>) {
  await db.user.updateMany({ where: { confirmEmailDueAt: { not: null }, emailVerified: true }, data: { confirmEmailDueAt: null } });
  const due = await db.user.findMany({
    where: { confirmEmailDueAt: { not: null }, deactivatedAt: null, anonymizedAt: null },
    orderBy: { confirmEmailDueAt: "asc" },
    take: catchUpLimit(mailServices(process.env)) || 20, // No services: on your PC, emails print in the terminal.
    select: { id: true, email: true },
  });

  const started = Date.now();
  let sent = 0;
  for (let i = 0; i < due.length && Date.now() - started < MAX_RUN_MS; i += AT_ONCE) {
    const batch = due.slice(i, i + AT_ONCE);
    await Promise.allSettled(batch.map((u) => send(u.email)));
    const stillDue = await db.user.count({ where: { id: { in: batch.map((u) => u.id) }, confirmEmailDueAt: { not: null } } });
    sent += batch.length - stillDue;
    if (stillDue > 0) break; // Still failing, so try again tomorrow.
  }
  return sent;
}
