import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCategory, getStatus, STATUSES } from "@/lib/categories";
import { areaHref } from "@/lib/countries";
import { getIssueDetail } from "@/lib/queries";
import { reportContent, setIssueStatus, toggleRsvp, toggleSupport } from "@/app/actions/community";
import { LocalTime, RelativeTime } from "@/components/local-time";
import {
  CampaignForm,
  CommentForm,
  LetterBuilder,
  MeetupForm,
  RepLookup,
  ShareButton,
  SignForm,
} from "@/components/issue-forms";
import { buttonStyles } from "@/components/styles";

export default function IssuePage(props: PageProps<"/issues/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-border/60" />}>
        <IssueContent params={props.params} />
      </Suspense>
    </div>
  );
}

function Card({ title, id, children, action }: { title: string; id?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SignInPrompt({ issueId, text }: { issueId: string; text: string }) {
  return (
    <Link href={`/signin?next=/issues/${issueId}`} className="text-sm font-medium text-brand-strong underline dark:text-brand">
      Sign in to {text}
    </Link>
  );
}

async function IssueContent({ params }: Pick<PageProps<"/issues/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const issue = await getIssueDetail(id, user?.id ?? null);
  if (!issue || (issue.hidden && issue.authorId !== user?.id)) notFound();

  const cat = getCategory(issue.category);
  const status = getStatus(issue.status);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const issueUrl = `${appUrl}/issues/${issue.id}`;
  const place = `${issue.placeName}, ${issue.region}`;
  const isAuthor = user?.id === issue.authorId;

  return (
    <article>
      <Link href={areaHref(issue.country, issue.postalCode)} className="text-sm text-muted hover:text-foreground">
        ← Issues near {place}
      </Link>

      {issue.hidden && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This issue was hidden after community reports and is only visible to you while it&apos;s reviewed.
        </p>
      )}

      <header className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              {cat.emoji} {cat.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{issue.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Raised by {issue.author.name} · {place} · <RelativeTime iso={issue.createdAt.toISOString()} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={toggleSupport}>
            <input type="hidden" name="issueId" value={issue.id} />
            <button className={issue.viewerSupports ? buttonStyles.primary : buttonStyles.secondary} aria-pressed={issue.viewerSupports}>
              {issue.viewerSupports ? "✓ I care" : "I care about this"} · {issue._count.supports}
            </button>
          </form>
          <ShareButton url={issueUrl} title={issue.title} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="The issue">
            <p className="whitespace-pre-line leading-relaxed">{issue.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
              {isAuthor ? (
                <form action={setIssueStatus} className="flex items-center gap-2">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <span className="text-muted">Status:</span>
                  {Object.entries(STATUSES).map(([key, s]) => (
                    <button
                      key={key}
                      name="status"
                      value={key}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${key === issue.status ? s.className : "border border-border text-muted hover:bg-brand-soft"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </form>
              ) : (
                user && (
                  <form action={reportContent}>
                    <input type="hidden" name="targetType" value="issue" />
                    <input type="hidden" name="targetId" value={issue.id} />
                    <button className="text-xs text-muted hover:text-red-600">Report this issue</button>
                  </form>
                )
              )}
            </div>
          </Card>

          <Card title={`Discussion (${issue.comments.length})`} id="discussion">
            <ul className="space-y-5">
              {issue.comments.map((c) => (
                <li key={c.id} className="group">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong dark:text-brand">
                      {c.author.name[0]?.toUpperCase()}
                    </span>
                    <span className="font-medium">{c.author.name}</span>
                    {c.author.id === issue.authorId && <span className="rounded bg-border px-1.5 text-[10px] uppercase">author</span>}
                    <span className="text-muted">
                      <RelativeTime iso={c.createdAt.toISOString()} />
                    </span>
                    {user && user.id !== c.author.id && (
                      <form action={reportContent} className="ml-auto opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <input type="hidden" name="targetType" value="comment" />
                        <input type="hidden" name="targetId" value={c.id} />
                        <button className="text-xs text-muted hover:text-red-600">Report</button>
                      </form>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line pl-9 text-sm leading-relaxed">{c.body}</p>
                </li>
              ))}
              {issue.comments.length === 0 && <li className="text-sm text-muted">No comments yet. Start the conversation.</li>}
            </ul>
            <div className="mt-6 border-t border-border pt-4">
              {user ? <CommentForm issueId={issue.id} /> : <SignInPrompt issueId={issue.id} text="join the discussion" />}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Meetups" id="meetups">
            <ul className="space-y-4">
              {issue.meetups.map((m) => {
                const going = Array.isArray(m.rsvps) && m.rsvps.length > 0;
                const full = !!m.capacity && m._count.rsvps >= m.capacity;
                return (
                  <li key={m.id} id={`meetup-${m.id}`} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-strong dark:text-brand">
                      <LocalTime iso={m.startsAt.toISOString()} />
                    </p>
                    <p className="mt-1 font-medium">{m.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {m.isOnline ? "🖥️ Online" : `📍 ${m.location}`} · hosted by {m.organizer.name}
                    </p>
                    {m.description && <p className="mt-2 whitespace-pre-line text-sm">{m.description}</p>}
                    {m.isOnline && going && /^https?:\/\//.test(m.location) && (
                      <a href={m.location} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 block text-sm text-brand-strong underline dark:text-brand">
                        Join link
                      </a>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted">
                        {m._count.rsvps} going{m.capacity ? ` of ${m.capacity}` : ""}
                      </span>
                      {user ? (
                        <form action={toggleRsvp}>
                          <input type="hidden" name="meetupId" value={m.id} />
                          <button
                            disabled={!going && full}
                            className={`${going ? buttonStyles.primary : buttonStyles.secondary} !px-3 !py-1`}
                          >
                            {going ? "✓ Going" : full ? "Full" : "RSVP"}
                          </button>
                        </form>
                      ) : (
                        <SignInPrompt issueId={issue.id} text="RSVP" />
                      )}
                    </div>
                  </li>
                );
              })}
              {issue.meetups.length === 0 && <li className="text-sm text-muted">No upcoming meetups. Getting people in a room is the fastest way to build momentum.</li>}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              {user ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-brand-strong dark:text-brand">+ Organize a meetup</summary>
                  <div className="mt-4">
                    <MeetupForm issueId={issue.id} />
                  </div>
                </details>
              ) : (
                <SignInPrompt issueId={issue.id} text="organize a meetup" />
              )}
            </div>
          </Card>

          <Card title="Take action" id="advocacy">
            <div className="space-y-6">
              {issue.campaigns.map((c) => {
                const pct = Math.min(100, Math.round((c._count.signatures / c.goal) * 100));
                return (
                  <div key={c.id} className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Campaign to {c.target}</p>
                    <p className="text-sm font-medium leading-relaxed">{c.ask}</p>
                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        <strong className="text-foreground">{c._count.signatures}</strong> of {c.goal} signatures · started by {c.creator.name}
                      </p>
                    </div>
                    {user ? <SignForm campaignId={c.id} signed={issue.viewerSigned.has(c.id)} /> : <SignInPrompt issueId={issue.id} text="sign" />}
                    {c.signatures.length > 0 && (
                      <ul className="space-y-1.5 border-l-2 border-brand-soft pl-3">
                        {c.signatures.map((s) => (
                          <li key={s.userId} className="text-xs text-muted">
                            “{s.note}” — {s.user.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-brand-strong dark:text-brand">✉️ Write to {c.target}</summary>
                      <div className="mt-3 space-y-4">
                        <LetterBuilder
                          issueTitle={issue.title}
                          issueUrl={issueUrl}
                          ask={c.ask}
                          target={c.target}
                          signatures={c._count.signatures}
                          place={place}
                        />
                      </div>
                    </details>
                  </div>
                );
              })}

              {issue.campaigns.length === 0 && (
                <p className="text-sm text-muted">
                  Ready to push for a fix? Start a campaign with a clear ask, gather signatures, and send it to the people who can act.
                </p>
              )}

              {user ? (
                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-brand-strong dark:text-brand">
                    + {issue.campaigns.length ? "Start another campaign" : "Start a campaign"}
                  </summary>
                  <div className="mt-4">
                    <CampaignForm issueId={issue.id} />
                  </div>
                </details>
              ) : (
                <SignInPrompt issueId={issue.id} text="start a campaign" />
              )}

              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">Find your representatives</h3>
                <RepLookup country={issue.country} />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </article>
  );
}
