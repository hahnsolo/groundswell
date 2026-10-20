import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRIES, areaHref } from "@/lib/countries";
import { setHomeArea, toggleRsvp, toggleSupport } from "@/app/actions/community";
import { DeleteAccountForm } from "@/components/account-forms";
import { signOut } from "@/app/actions/auth";
import { ACCOUNT_GRACE_DAYS } from "@/lib/accounts";
import { LocalTime } from "@/components/local-time";
import { SubmitButton } from "@/components/ui";
import { inputStyles } from "@/components/styles";

export const metadata: Metadata = { title: "Your activity" };

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
  const [issues, supported, rsvps, credential] = await Promise.all([
    db.issue.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.issueSupport.findMany({
      where: { userId: user.id, issue: { authorId: { not: user.id }, hidden: false } },
      include: { issue: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.rsvp.findMany({
      where: { userId: user.id, meetup: { startsAt: { gte: new Date() }, issue: { hidden: false } } },
      include: { meetup: { include: { issue: { select: { title: true } } } } },
      orderBy: { meetup: { startsAt: "asc" } },
    }),
    db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } }),
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
            <Link href={`/issues/${r.meetup.issueId}#meetup-${r.meetupId}`} className={`${linkRow} flex-1`}>
              <span className="font-medium">{r.meetup.title}</span>
              {r.meetup.organizerId === user.id && <span className={`${tag} ml-2`}>Hosting</span>}
              <span className="block text-sm text-muted">
                <LocalTime iso={r.meetup.startsAt.toISOString()} /> · {r.meetup.issue.title}
              </span>
            </Link>
            {r.meetup.organizerId === user.id ? (
              // Stepping down hands the meetup to someone, so it's confirmed on the meetup itself.
              <Link href={`/issues/${r.meetup.issueId}#meetup-${r.meetupId}`} className={xButton}>
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
        <h2 className="mb-3 font-semibold">Issues you raised</h2>
        {issues.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {issues.map((i) => (
          <Link key={i.id} href={`/issues/${i.id}`} className={linkRow}>
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
        <h2 className="mb-3 font-semibold">Issues you support</h2>
        {supported.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {supported.map((s) => (
          <div key={s.issueId} className={row}>
            <Link href={`/issues/${s.issueId}`} className={`${linkRow} flex-1`}>
              {s.issue.title} <span className="text-sm text-muted">· {s.issue.placeName}</span>
            </Link>
            <form action={toggleSupport}>
              <input type="hidden" name="issueId" value={s.issueId} />
              <button className={xButton} aria-label={`Stop supporting ${s.issue.title}`}>
                ✕ Stop supporting
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Your account</h2>
        <p className="mb-4 text-sm text-muted">Signed in as {user.email}.</p>
        <DeleteAccountForm hasPassword={!!credential} graceDays={ACCOUNT_GRACE_DAYS} />
      </section>
    </div>
  );
}
