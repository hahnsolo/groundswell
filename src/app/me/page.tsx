import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRIES, areaHref } from "@/lib/countries";
import { setHomeArea } from "@/app/actions/community";
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
    : sp.welcome
      ? "Welcome to Groundswell! Set your home area below so we can show you what's happening nearby."
      : null;
  const openReports = user.isAdmin ? await db.report.count({ where: { resolved: false } }) : 0;
  const [issues, supported, rsvps] = await Promise.all([
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
  ]);

  const section = "rounded-xl border border-border bg-surface p-5";
  const linkRow = "block rounded-lg px-2 py-1.5 -mx-2 hover:bg-brand-soft";

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm font-medium">
          {notice}
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {user.name}</h1>

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
          <Link href={areaHref(user.homeCountry, user.homePostal)} className="mt-3 inline-block text-sm text-brand-strong underline dark:text-brand">
            Go to my area →
          </Link>
        )}
      </section>

      <section className={section}>
        <h2 className="mb-3 font-semibold">Upcoming meetups</h2>
        {rsvps.length === 0 && <p className="text-sm text-muted">You haven&apos;t RSVP&apos;d to any upcoming meetups.</p>}
        {rsvps.map((r) => (
          <Link key={r.meetupId} href={`/issues/${r.meetup.issueId}#meetup-${r.meetupId}`} className={linkRow}>
            <span className="font-medium">{r.meetup.title}</span>
            <span className="block text-sm text-muted">
              <LocalTime iso={r.meetup.startsAt.toISOString()} /> · {r.meetup.issue.title}
            </span>
          </Link>
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
          <Link key={s.issueId} href={`/issues/${s.issueId}`} className={linkRow}>
            {s.issue.title} <span className="text-sm text-muted">· {s.issue.placeName}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
