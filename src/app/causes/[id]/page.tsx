import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { STATUSES } from "@/lib/categories";
import { getCauseDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { reportContent, setCauseStatus } from "@/app/actions/community";
import { LocalTime } from "@/components/local-time";
import { CampaignForm, LetterBuilder, RepLookup, SignForm } from "@/components/cause-forms";
import { Panel, SignInPrompt } from "@/components/cause-parts";
import { FixerChangeForm } from "@/components/fixer-field";
import { campaignTargetFor } from "@/lib/fixers";

// The cause's holding page: what it's about, the ask, and what's coming up.
export default function AboutTab(props: PageProps<"/causes/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-border/60" />}>
      <About params={props.params} />
    </Suspense>
  );
}

async function About({ params }: Pick<PageProps<"/causes/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cause = await getCauseDetail(id, user?.id ?? null);
  if (!cause || cause.removedAt || (cause.hidden && cause.authorId !== user?.id)) return null; // the layout explains

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const causeUrl = `${appUrl}/causes/${cause.id}`;
  const place = `${cause.placeName}, ${cause.region}`;
  const isAuthor = user?.id === cause.authorId;
  const next = cause.meetups.find((m) => m.upcoming);

  return (
    <div className="space-y-6">
      <Panel>
        <p className="whitespace-pre-line text-[17px] leading-relaxed">{cause.description}</p>
      </Panel>

      {next && (
        <Link
          href={`/events/${next.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-ink p-4 text-background hover:opacity-95"
        >
          <span className="min-w-0">
            <span className="block text-[11px] uppercase tracking-wide text-mustard dark:text-brand-strong">Next event</span>
            <span className="font-display text-lg font-semibold">{next.title}</span>
            <span className="block text-sm opacity-80">
              <LocalTime iso={next.startsAt.toISOString()} /> · {next.isOnline ? "Online" : next.location} · {next._count.rsvps} going
            </span>
          </span>
          <span className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white">See event</span>
        </Link>
      )}

      <Panel title={cause.campaigns.length > 1 ? "The asks" : "The ask"} id="ask">
        <div className="space-y-8">
          {cause.campaigns.map((c) => {
            const pct = Math.min(100, Math.round((c._count.signatures / c.goal) * 100));
            return (
              <div key={c.id} className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">To {c.target}</p>
                <p className="font-display text-lg font-semibold leading-snug">{c.ask}</p>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    <strong className="text-foreground">{c._count.signatures}</strong> of {c.goal} signed · started by{" "}
                    {displayName(c.creator)}
                  </p>
                </div>
                {user ? (
                  // Keyed on signed so the form resets after signing or removing a signature.
                  <SignForm key={String(cause.viewerSigned.has(c.id))} campaignId={c.id} signed={cause.viewerSigned.has(c.id)} />
                ) : (
                  <SignInPrompt next={`/causes/${cause.id}`} text="sign" />
                )}
                {c.signatures.length > 0 && (
                  <ul className="space-y-1.5 border-l-2 border-border pl-3">
                    {c.signatures.map((s) => (
                      <li key={s.userId} className="text-xs text-muted">
                        “{s.note}” — {displayName(s.user)}
                      </li>
                    ))}
                  </ul>
                )}
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-link">✉️ Write to {c.target}</summary>
                  <div className="mt-3 space-y-4">
                    <LetterBuilder
                      causeTitle={cause.title}
                      causeUrl={causeUrl}
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

          {cause.campaigns.length === 0 && (
            <p className="text-sm text-muted">
              No ask yet. When neighbours are ready to push for a fix, start a campaign: a clear request to the person who can act,
              backed by signatures.
            </p>
          )}

          {user ? (
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-medium text-link">
                + {cause.campaigns.length ? "Start another campaign" : "Start a campaign"}
              </summary>
              <div className="mt-4">
                <CampaignForm
                  causeId={cause.id}
                  defaultTarget={campaignTargetFor(cause.fixer, cause.fixerOther, cause.country, cause.placeName)}
                />
              </div>
            </details>
          ) : (
            <SignInPrompt next={`/causes/${cause.id}`} text="start a campaign" />
          )}

          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">Find your representatives</h3>
            <RepLookup country={cause.country} />
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {isAuthor ? (
          <div className="w-full space-y-3">
          <form action={setCauseStatus} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="causeId" value={cause.id} />
            <span className="text-muted">Where it stands:</span>
            {Object.entries(STATUSES).map(([key, s]) => (
              <button
                key={key}
                name="status"
                value={key}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${key === cause.status ? s.className : "border border-border text-muted hover:border-ink"}`}
              >
                {key === "resolved" ? "Won / resolved" : s.label}
              </button>
            ))}
          </form>
          <FixerChangeForm causeId={cause.id} country={cause.country} fixer={cause.fixer} fixerOther={cause.fixerOther} />
          </div>
        ) : (
          user?.emailVerified && (
            <form action={reportContent}>
              <input type="hidden" name="targetType" value="cause" />
              <input type="hidden" name="targetId" value={cause.id} />
              <button className="text-xs text-muted hover:text-red-600">Report this cause</button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
