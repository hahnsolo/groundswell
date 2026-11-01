import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getEventDetail } from "@/lib/event-queries";
import { displayName } from "@/lib/accounts";
import { peopleLine } from "@/lib/momentum";
import { stepDownAsHost, toggleRsvp } from "@/app/actions/community";
import { LocalTime } from "@/components/local-time";
import { ShareButton } from "@/components/issue-forms";
import { Panel, SignInPrompt } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

export const metadata: Metadata = { title: "Event" };

// Fixed light fills (not theme colours), so the dark initials stay readable in dark mode too.
const AVATAR_COLOURS = ["bg-[#e9b44c]", "bg-[#a9c4b2]", "bg-[#f0c9b8]"];

// An event always belongs to a cause; this page says so up top and links back.
export default function EventPage(props: PageProps<"/events/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-border/60" />}>
        <Event params={props.params} />
      </Suspense>
    </div>
  );
}

async function Event({ params }: Pick<PageProps<"/events/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const e = await getEventDetail(id, user?.id ?? null);
  // Same visibility as its cause: gone if the cause was removed or is hidden (except to its author).
  if (!e || e.issue.removedAt || (e.issue.hidden && e.issue.authorId !== user?.id)) notFound();

  const hosting = user?.id === e.organizerId;
  const full = !!e.capacity && e._count.rsvps >= e.capacity;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const here = `/events/${e.id}`;

  return (
    <article>
      <Link href={`/causes/${e.issue.id}/events`} className="text-sm text-muted hover:text-foreground">
        ← Part of <span className="underline underline-offset-2">{e.issue.title}</span>
      </Link>

      <header className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Event · {e.issue.placeName}
          {e.over ? " · this has happened" : !e.upcoming ? " · happening now" : ""}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{e.title}</h1>
      </header>

      <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <dl className="space-y-2 text-[15px]">
          <div className="flex gap-3">
            <dt className="w-5 shrink-0" aria-label="When">🗓️</dt>
            <dd>
              <LocalTime iso={e.startsAt.toISOString()} options={{ weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }} />
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-5 shrink-0" aria-label="Where">{e.isOnline ? "🖥️" : "📍"}</dt>
            <dd>
              {e.isOnline ? (
                e.viewerGoing || hosting ? (
                  /^https?:\/\//.test(e.location) ? (
                    <a href={e.location} target="_blank" rel="noopener noreferrer nofollow" className="text-link underline">
                      Join the video call
                    </a>
                  ) : (
                    e.location
                  )
                ) : (
                  "Online. The link appears here once you say you're going."
                )
              ) : (
                e.location
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-5 shrink-0" aria-label="Host">👤</dt>
            <dd>
              Hosted by {displayName(e.organizer)}
              {e.hostChangedAt && " (took over)"}
            </dd>
          </div>
        </dl>

        {!e.over && (
          <div className="flex flex-col gap-2 sm:items-end">
            {hosting ? (
              <span className={buttonStyles.selected}>✓ You&apos;re hosting</span>
            ) : user ? (
              <form action={toggleRsvp}>
                <input type="hidden" name="meetupId" value={e.id} />
                <button disabled={!e.viewerGoing && full} className={e.viewerGoing ? buttonStyles.selected : buttonStyles.primary}>
                  {e.viewerGoing ? "✓ You're going" : full ? "Full" : "I'll be there"}
                </button>
              </form>
            ) : (
              <Link href={`/signin?next=${encodeURIComponent(here)}`} className={buttonStyles.primary}>
                I&apos;ll be there
              </Link>
            )}
            {e.viewerGoing && !hosting && <p className="text-xs text-muted">Click again if you can&apos;t make it.</p>}
            <div className="flex gap-2">
              <a href={`/events/${e.id}/calendar.ics`} className={`${buttonStyles.secondary} !px-3 !py-1.5`}>
                Add to calendar
              </a>
              <ShareButton url={`${appUrl}${here}`} title={e.title} />
            </div>
          </div>
        )}
      </div>

      {e.description && (
        <div className="mt-6">
          <Panel>
            <p className="whitespace-pre-line leading-relaxed">{e.description}</p>
          </Panel>
        </div>
      )}

      <section className="mt-6 flex flex-wrap items-center gap-3 text-sm" aria-label="Who's going">
        {e.goingNames.length > 0 && (
          <span className="flex" aria-hidden="true">
            {e.goingNames.slice(0, 3).map((name, i) => (
              <span
                key={i}
                className={`-mr-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-background text-[11px] font-semibold text-[#1f2a44] ${AVATAR_COLOURS[i]}`}
              >
                {name[0]?.toUpperCase()}
              </span>
            ))}
          </span>
        )}
        <span className={e.goingNames.length > 0 ? "ml-1.5" : ""}>
          {peopleLine(e.goingNames, e._count.rsvps, "going")}
          {e.capacity ? ` · ${Math.max(0, e.capacity - e._count.rsvps)} of ${e.capacity} places left` : ""}
        </span>
      </section>

      {hosting && e.upcoming && (
        <details className="mt-6 border-t border-border pt-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">Can&apos;t host it?</summary>
          <form action={stepDownAsHost} className="mt-2 max-w-md space-y-2">
            <input type="hidden" name="meetupId" value={e.id} />
            <p className="text-muted">
              The first person who said they&apos;re going becomes the host and gets an email. If nobody else is going, the event is cancelled.
            </p>
            <button className={`${buttonStyles.secondary} !px-3 !py-1 text-xs`}>Step down as host</button>
          </form>
        </details>
      )}

      {!user && !e.over && (
        <p className="mt-6 text-sm">
          <SignInPrompt next={here} text="say you're going" />
        </p>
      )}
    </article>
  );
}
