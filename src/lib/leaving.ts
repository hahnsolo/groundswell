import "server-only";
import { db } from "./db";
import { appUrl, sendEmail } from "./mail";
import { anonymizeCutoff, anonymizedEmail, FORMER_MEMBER, pickNewHost } from "./accounts";

// Everything that happens when someone steps back: from a meetup they host,
// from an issue, or from Groundswell altogether.

/** Upcoming = hasn't started yet. Past meetups keep their host for the record. */
const upcoming = () => ({ startsAt: { gt: new Date() } });

/**
 * The host of an upcoming meetup is leaving it. Hand it to the earliest RSVP
 * who still has an account (and email them), or cancel it if there's nobody.
 */
export async function handOverMeetup(meetupId: string, leavingUserId: string) {
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    include: {
      issue: { select: { id: true, title: true } },
      rsvps: { select: { userId: true, createdAt: true, user: { select: { deactivatedAt: true } } } },
    },
  });
  if (!meetup || meetup.organizerId !== leavingUserId) return;

  const newHostId = pickNewHost(
    meetup.rsvps.map((r) => ({ userId: r.userId, createdAt: r.createdAt, active: !r.user.deactivatedAt })),
    leavingUserId,
  );
  if (!newHostId) {
    await db.meetup.delete({ where: { id: meetupId } });
    return;
  }

  await db.$transaction([
    db.meetup.update({ where: { id: meetupId }, data: { organizerId: newHostId, hostChangedAt: new Date() } }),
    db.rsvp.deleteMany({ where: { meetupId, userId: leavingUserId } }),
  ]);

  const host = await db.user.findUnique({ where: { id: newHostId }, select: { name: true, email: true } });
  if (!host) return;
  try {
    await sendEmail({
      to: host.email,
      subject: `You're now hosting "${meetup.title}"`,
      text: `Hi ${host.name},\n\nThe host of "${meetup.title}" (about "${meetup.issue.title}") had to step back. You were the first to RSVP, so you're now the host.\n\nIf you can't host it, open the meetup and choose "Step down as host" — it'll pass to the next person who's going:\n${appUrl(`/issues/${meetup.issue.id}/events#meetup-${meetup.id}`)}\n\nThanks for keeping it going!`,
    });
  } catch (err) {
    // The handover stands even if the email doesn't go out.
    console.error("Couldn't email new meetup host", err);
  }
}

/** Remove a person's RSVPs to upcoming meetups, handing over any they host. */
async function leaveUpcomingMeetups(userId: string, issueId?: string) {
  const where = { ...upcoming(), ...(issueId ? { issueId } : {}) };
  const hosted = await db.meetup.findMany({ where: { ...where, organizerId: userId }, select: { id: true } });
  for (const m of hosted) await handOverMeetup(m.id, userId);
  await db.rsvp.deleteMany({ where: { userId, meetup: where } });
}

/**
 * "Leave this issue": take back support, RSVPs to its upcoming meetups and
 * signatures on its campaigns. Comments stay — they're part of the conversation.
 */
export async function leaveIssue(userId: string, issueId: string) {
  await leaveUpcomingMeetups(userId, issueId);
  await db.$transaction([
    db.issueSupport.deleteMany({ where: { userId, issueId } }),
    db.signature.deleteMany({ where: { userId, campaign: { issueId } } }),
  ]);
}

/**
 * "Delete my account", step 1: sign out everywhere and step back from what's
 * still to come. Posts stay (shown as "Former member"); "I care" supports stay
 * as anonymous counts. Signing back in within the grace period restores it.
 */
export async function deactivateAccount(userId: string) {
  await leaveUpcomingMeetups(userId);
  await db.$transaction([
    db.signature.deleteMany({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } }),
  ]);
}

/**
 * Step 2, run by the daily job: once the grace period is over, wipe everything
 * that identifies the person. What they posted stays, credited to "Former member".
 */
export async function anonymizeExpiredAccounts(now = new Date()) {
  const due = await db.user.findMany({
    where: { deactivatedAt: { lt: anonymizeCutoff(now) }, anonymizedAt: null },
    select: { id: true, email: true },
  });
  for (const u of due) {
    await db.$transaction([
      // Passwords and Google/Apple links: nobody can sign in to it again.
      db.account.deleteMany({ where: { userId: u.id } }),
      db.session.deleteMany({ where: { userId: u.id } }),
      // Any outstanding password-reset or email links (Better Auth keys these by user id or email).
      db.verification.deleteMany({ where: { OR: [{ value: u.id }, { identifier: { contains: u.email } }] } }),
      db.user.update({
        where: { id: u.id },
        data: {
          name: FORMER_MEMBER,
          email: anonymizedEmail(u.id),
          emailVerified: false,
          image: null,
          homeCountry: null,
          homePostal: null,
          isAdmin: false,
          anonymizedAt: now,
        },
      }),
    ]);
  }
  return due.length;
}
