import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRIES, areaHref } from "@/lib/countries";
import { setHomeArea, setShowName, toggleRsvp, toggleMembership } from "@/app/actions/community";
import { DeleteAccountForm } from "@/components/account-forms";
import { EmailPrefsForm } from "@/components/email-prefs";
import { setCauseMuted } from "@/app/actions/notifications";
import { signOut } from "@/app/actions/auth";
import { ACCOUNT_GRACE_DAYS } from "@/lib/accounts";
import { LocalTime, RelativeTime } from "@/components/local-time";
import { after } from "next/server";
import { getInbox } from "@/lib/inbox";
import { SubmitButton } from "@/components/ui";
import { inputStyles } from "@/components/styles";
import { getLeaderHome } from "@/lib/leader-home";
import { PushToggle } from "@/components/push-toggle";
import { pushPublicKey } from "@/lib/push";
import type { NeedKind } from "@/lib/needs-you";
import { STAGE_LABELS, type Stage } from "@/lib/stages";

export const metadata: Metadata = { title: "Your activity" };

const NEED_ICONS: Record<NeedKind, string> = {
  lead_offer: "🧭",
  co_lead: "🤝",
  still_going: "⏳",
  confirm_win: "🎉",
  your_win: "🎉",
  reports: "🚩",
  hosting: "📅",
  new_members: "👋",
};

export default function MePage(props: PageProps<"/me">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-border/60" />}>
        <Me searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Me({ searchParams }: Pick<PageProps<"/me">, "searchParams">) {
  const user = await requireUser("/me");
  const sp = await searchParams;
  const notice = sp.verified
    ? "Thanks — your email is confirmed."
    : sp.restored
      ? "Welcome back — your account is restored. Signatures and RSVPs removed when you left weren't brought back, so add them again if you like."
      : sp.welcome
        ? "Welcome to Groundswell! Set your home area below so we can show you what's happening nearby."
        : null;
  const openReports = user.isAdmin ? await db.report.count({ where: { resolved: false } }) : 0;
  const pushKey = pushPublicKey();
  const inbox = await getInbox(user.id, 30);
  // Seeing them here marks them read, after the page is sent, so this page still shows which are new.
  if (inbox.unread > 0) after(() => db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }));
  const home = await getLeaderHome(user.id);
  const ledIds = home.led.map((c) => c.id);
  const [causes, supported, rsvps, credential, prefs] = await Promise.all([
    // Started but not leading any more (handed over), or taken down: the ones they lead are listed above.
    db.cause.findMany({ where: { authorId: user.id, id: { notIn: ledIds } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.causeMember.findMany({
      where: { userId: user.id, causeId: { notIn: ledIds }, cause: { authorId: { not: user.id }, hidden: false } },
      include: { cause: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.rsvp.findMany({
      where: { userId: user.id, meetup: { endsAt: { gt: new Date() }, cause: { hidden: false } } },
      include: { meetup: { include: { cause: { select: { title: true } } } } },
      orderBy: { meetup: { startsAt: "asc" } },
    }),
    db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } }),
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { notifyEvents: true, notifyWinCheck: true, notifyWins: true, notifyNewMembers: true, notifyChatDigest: true, notifyAnnouncements: true, showName: true },
    }),
  ]);

  const section = "rounded-xl border border-border bg-surface p-5";
  const linkRow = "block rounded-lg px-2 py-1.5 -mx-2 hover:bg-brand-soft";
  const row = "flex items-center gap-2";
  const xButton = "shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-brand-soft hover:text-foreground";
  const tag = "rounded-full bg-brand-soft px-2 py-0.5 text-xs text-link";

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm font-medium">
          {notice}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {user.name}</h1>
        <form action={signOut}>
          <button className="rounded-md border-[1.5px] border-ink px-3 py-1 text-sm hover:bg-surface">Sign out</button>
        </form>
      </div>

      {home.needs.length > 0 && (
        <section className={`${section} border-[1.5px] border-ink bg-mustard/15`} aria-labelledby="needs-you">
          <h2 id="needs-you" className="mb-3 font-semibold">
            Needs you
          </h2>
          <ul className="space-y-1">
            {home.needs.map((n) => (
              <li key={n.key}>
                <Link href={n.href} className={`${linkRow} flex items-start gap-2`}>
                  <span aria-hidden="true">{NEED_ICONS[n.kind]}</span>
                  <span className="min-w-0">{n.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${section} scroll-mt-20`} id="notifications" aria-labelledby="your-notifications">
        <h2 id="your-notifications" className="mb-3 font-semibold">
          Notifications
        </h2>
        {inbox.items.length === 0 && <p className="text-sm text-muted">Nothing yet. News from your causes will show up here, and under your name icon.</p>}
        <ul className="space-y-1">
          {inbox.items.map((n) => (
            <li key={n.id}>
              <Link href={n.url} className={`${linkRow} ${n.unread ? "bg-mustard/15" : ""}`}>
                <span className="font-medium">{n.title}</span>
                {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                <span className="block text-xs text-muted">
                  <RelativeTime iso={n.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {home.led.length > 0 && (
        <section className={section} aria-labelledby="you-lead">
          <h2 id="you-lead" className="mb-3 font-semibold">
            Causes you lead
          </h2>
          {home.needs.length === 0 && <p className="mb-2 text-sm text-muted">Nothing needs you right now.</p>}
          {home.led.map((c) => (
            <Link key={c.id} href={`/causes/${c.id}`} className={linkRow}>
              <span className="font-medium">{c.title}</span>
              {c.coLeading && <span className={`${tag} ml-2`}>Co-leader</span>}
              {c.hidden && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Under review</span>
              )}
              <span className="block text-sm text-muted">
                {STAGE_LABELS[c.stage as Stage] ?? c.stage} · {c.members} {c.members === 1 ? "member" : "members"} · {c.placeName}
              </span>
            </Link>
          ))}
        </section>
      )}

      {user.isAdmin && (
        <Link href="/admin/reports" className={`${section} flex items-center justify-between hover:border-brand/50`}>
          <span className="font-semibold">Moderation queue</span>
          <span className="text-sm text-muted">{openReports} open report{openReports === 1 ? "" : "s"} →</span>
        </Link>
      )}

      <section className={section}>
        <h2 className="mb-3 font-semibold">Home area</h2>
        <form action={setHomeArea} className="flex flex-col gap-2 sm:flex-row">
          <select name="country" defaultValue={user.homeCountry ?? "US"} aria-label="Country" className={`${inputStyles} sm:w-44`}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="postal" defaultValue={user.homePostal ?? ""} placeholder="Postal / ZIP code" aria-label="Postal or ZIP code" className={inputStyles} />
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
        {user.homeCountry && user.homePostal && (
          <Link href={areaHref(user.homeCountry, user.homePostal)} className="mt-3 inline-block text-sm text-link underline">
            Go to my area →
          </Link>
        )}
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Upcoming meetups</h2>
        {rsvps.length === 0 && <p className="text-sm text-muted">You haven&apos;t RSVP&apos;d to any upcoming meetups.</p>}
        {rsvps.map((r) => (
          <div key={r.meetupId} className={row}>
            <Link href={`/events/${r.meetupId}`} className={`${linkRow} min-w-0 flex-1`}>
              <span className="font-medium">{r.meetup.title}</span>
              {r.meetup.organizerId === user.id && <span className={`${tag} ml-2`}>Hosting</span>}
              <span className="block text-sm text-muted">
                <LocalTime iso={r.meetup.startsAt.toISOString()} /> · {r.meetup.cause.title}
              </span>
            </Link>
            {r.meetup.organizerId === user.id ? (
              // Stepping down hands the meetup to someone, so it's confirmed on the meetup itself.
              <Link href={`/events/${r.meetupId}`} className={xButton}>
                Manage
              </Link>
            ) : (
              <form action={toggleRsvp}>
                <input type="hidden" name="meetupId" value={r.meetupId} />
                <button className={xButton} aria-label={`Not going to ${r.meetup.title}`}>
                  ✕ Not going
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Causes you started</h2>
        {causes.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {causes.map((i) => (
          <Link key={i.id} href={`/causes/${i.id}`} className={linkRow}>
            {i.title} <span className="text-sm text-muted">· {i.placeName}</span>
            {i.removedAt ? (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-200">Removed</span>
            ) : (
              i.hidden && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Under review</span>
              )
            )}
          </Link>
        ))}
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Causes you&apos;ve joined</h2>
        {supported.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {supported.map((s) => (
          <div key={s.causeId} className={row}>
            <Link href={`/causes/${s.causeId}`} className={`${linkRow} min-w-0 flex-1`}>
              {s.cause.title} <span className="text-sm text-muted">· {s.cause.placeName}</span>
            </Link>
            <form action={setCauseMuted}>
              <input type="hidden" name="causeId" value={s.causeId} />
              <input type="hidden" name="muted" value={s.muted ? "0" : "1"} />
              <button className={xButton} aria-label={`${s.muted ? "Unmute" : "Mute"} notifications about ${s.cause.title}`}>
                {s.muted ? "🔕 Muted" : "Mute"}
              </button>
            </form>
            <form action={toggleMembership}>
              <input type="hidden" name="causeId" value={s.causeId} />
              <button className={xButton} aria-label={`Leave ${s.cause.title}`}>
                ✕ Leave
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className={`${section} scroll-mt-20`} id="privacy">
        <h2 className="mb-3 font-semibold">Privacy</h2>
        <form action={setShowName} className="space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="showName" defaultChecked={prefs.showName} className="mt-1" />
            <span>
              <span className="font-medium">Show my name on causes I join</span>
              <span className="block text-muted">
                Off: you appear as &ldquo;A neighbour&rdquo; in chats, signatures and who&apos;s going, and you&apos;re just counted. The people leading each
                cause still see your name, and it still goes on a petition you sign. Leading a cause or hosting an event is public, so your name shows there.
              </span>
            </span>
          </label>
          <SubmitButton variant="secondary">Save privacy setting</SubmitButton>
        </form>
      </section>

      {pushKey && (
        <section className={`${section} scroll-mt-20`} id="push">
          <h2 className="mb-3 font-semibold">Notifications on this device</h2>
          <PushToggle publicKey={pushKey} />
        </section>
      )}

      <section className={`${section} scroll-mt-20`} id="email">
        <h2 className="mb-1 font-semibold">What you hear about</h2>
        <p className="mb-4 text-sm text-muted">These show under your name icon, and by push if it&apos;s on for a device. To stop them for one cause, mute it above.</p>
        <EmailPrefsForm prefs={prefs} />
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Your account</h2>
        <p className="mb-4 text-sm text-muted">Signed in as {user.email}.</p>
        <DeleteAccountForm hasPassword={!!credential} graceDays={ACCOUNT_GRACE_DAYS} />
      </section>
    </div>
  );
}
