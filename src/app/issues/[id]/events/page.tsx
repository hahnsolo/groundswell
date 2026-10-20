import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getIssueDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { stepDownAsHost, toggleRsvp } from "@/app/actions/community";
import { LocalTime } from "@/components/local-time";
import { MeetupForm } from "@/components/issue-forms";
import { Panel, SignInPrompt } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

// Events belong to a cause: meetups in person or online.
export default function EventsTab(props: PageProps<"/issues/[id]/events">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-border/60" />}>
      <Events params={props.params} />
    </Suspense>
  );
}

async function Events({ params }: Pick<PageProps<"/issues/[id]/events">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const issue = await getIssueDetail(id, user?.id ?? null);
  if (!issue || issue.removedAt || (issue.hidden && issue.authorId !== user?.id)) return null; // the layout explains
  const here = `/issues/${issue.id}/events`;

  return (
    <div className="space-y-4">
      {issue.meetups.map((m) => {
        const going = Array.isArray(m.rsvps) && m.rsvps.length > 0;
        const full = !!m.capacity && m._count.rsvps >= m.capacity;
        const hosting = user?.id === m.organizerId;
        return (
          <section key={m.id} id={`meetup-${m.id}`} className="scroll-mt-20 rounded-md border-[1.5px] border-ink bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <LocalTime iso={m.startsAt.toISOString()} />
                  {!m.upcoming && " · happening now"}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{m.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {m.isOnline ? "🖥️ Online" : `📍 ${m.location}`} · hosted by {displayName(m.organizer)}
                  {m.hostChangedAt && " (took over)"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {hosting ? (
                  <span className={`${buttonStyles.selected} !px-3 !py-1.5`}>✓ Hosting</span>
                ) : user ? (
                  <form action={toggleRsvp}>
                    <input type="hidden" name="meetupId" value={m.id} />
                    <button
                      disabled={!going && full}
                      className={`${going ? buttonStyles.selected : buttonStyles.primary} !px-3 !py-1.5`}
                    >
                      {going ? "✓ Going" : full ? "Full" : "I'll be there"}
                    </button>
                  </form>
                ) : (
                  <SignInPrompt next={here} text="RSVP" />
                )}
                <span className="text-xs text-muted">
                  {m._count.rsvps} going{m.capacity ? ` of ${m.capacity}` : ""}
                </span>
              </div>
            </div>
            {m.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{m.description}</p>}
            {m.isOnline && (going || hosting) && /^https?:\/\//.test(m.location) && (
              <a href={m.location} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm font-medium text-link underline">
                Join link
              </a>
            )}
            {hosting && m.upcoming && (
              <details className="mt-4 border-t border-border pt-3 text-xs">
                <summary className="cursor-pointer text-muted hover:text-foreground">Can&apos;t host it?</summary>
                <form action={stepDownAsHost} className="mt-2 space-y-2">
                  <input type="hidden" name="meetupId" value={m.id} />
                  <p className="text-muted">
                    The first person who RSVP&apos;d becomes the host and gets an email. If nobody else is going, the event is cancelled.
                  </p>
                  <button className={`${buttonStyles.secondary} !px-3 !py-1 text-xs`}>Step down as host</button>
                </form>
              </details>
            )}
          </section>
        );
      })}

      {issue.meetups.length === 0 && (
        <Panel>
          <p className="text-center text-sm text-muted">No events coming up. Getting people in a room is the fastest way to build momentum.</p>
        </Panel>
      )}

      <Panel>
        {user ? (
          <details>
            <summary className="cursor-pointer font-medium text-link">+ Organize an event</summary>
            <div className="mt-4">
              <MeetupForm issueId={issue.id} />
            </div>
          </details>
        ) : (
          <SignInPrompt next={here} text="organize an event" />
        )}
      </Panel>
    </div>
  );
}
