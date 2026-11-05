import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCauseDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { removeCoLeader, reportContent, withdrawLeadOffer, withdrawWin } from "@/app/actions/community";
import { coLeadInviteOpen, leadsCause, MAX_CO_LEADERS } from "@/lib/leadership";
import { MAX_LEADING_CAUSES } from "@/lib/leading-limit";
import { isActive } from "@/lib/stages";
import { CloseCauseForm, LogContactForm, LogReplyForm, ProposeWinForm } from "@/components/stage-parts";
import { db } from "@/lib/db";
import { LEAD_OFFER_DAYS, offerOpen } from "@/lib/leadership";
import { CoLeaderInviteForm, HandOverForm } from "@/components/handover";
import { LocalTime } from "@/components/local-time";
import { CampaignForm, LetterBuilder, SignForm } from "@/components/cause-forms";
import { WhoCanFix } from "@/components/who-can-fix";
import { getAreaReps } from "@/lib/area-reps";
import { leadRep, repTarget } from "@/lib/representatives";
import { Panel, SignInPrompt } from "@/components/cause-parts";
import { FixerChangeForm } from "@/components/fixer-field";
import { EditCauseForm } from "@/components/cause-form";
import { canEditCause } from "@/lib/editing";
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
  const isLeader = user?.id === cause.leaderId;
  // The leader and co-leaders share the tools; handing over and choosing co-leaders stay with the leader.
  const leads = leadsCause(cause, user?.id);
  const coLeads = cause.coLeaders.filter((c) => c.acceptedAt || coLeadInviteOpen(c));
  const coLeadSpaces = MAX_CO_LEADERS - coLeads.length;
  // Handing over: an offer still waiting for an answer, and the members the lead could go to.
  const latestOffer = cause.leadOffers[0];
  const pendingOffer = isLeader && latestOffer && offerOpen(latestOffer) ? latestOffer : null;
  const pendingOfferUntil = pendingOffer ? new Date(pendingOffer.createdAt.getTime() + LEAD_OFFER_DAYS * 24 * 60 * 60 * 1000) : null;
  const handOverTo = isLeader
    ? (
        await db.causeMember.findMany({
          where: { causeId: cause.id, userId: { not: cause.leaderId }, user: { deactivatedAt: null } },
          orderBy: { createdAt: "asc" },
          select: { user: { select: { id: true, name: true } } },
        })
      ).map((m) => m.user)
    : [];
  const next = cause.meetups.find((m) => m.upcoming);
  const active = isActive(cause.stage);
  // What's been done, newest first: logged contacts and replies, campaigns, the first meetup, the outcome.
  const HOW: Record<string, string> = { letter: "by letter", email: "by email", call: "by phone", meeting: "in a meeting" };
  const timeline = [
    ...cause.actions.map((a) =>
      a.kind === "contacted"
        ? { at: a.happenedAt, icon: "📨", text: `Contacted ${a.who} ${HOW[a.how ?? ""] ?? ""}`.trim(), note: a.note }
        : a.kind === "replied"
          ? { at: a.happenedAt, icon: "💬", text: "They replied", note: a.note }
          : { at: a.happenedAt, icon: "🔁", text: `${displayName(a.createdBy)} confirmed it's still going`, note: null },
    ),
    ...cause.campaigns.map((c) => ({ at: c.createdAt, icon: "✍️", text: `Campaign started, asking ${c.target}`, note: null })),
    ...(cause.firstEvent ? [{ at: cause.firstEvent.startsAt, icon: "📅", text: `First meetup: ${cause.firstEvent.title}`, note: null }] : []),
    ...(cause.stage === "won" && cause.resolvedAt ? [{ at: cause.resolvedAt, icon: "🎉", text: "Won, confirmed by members", note: null }] : []),
    ...(cause.stage === "closed" && cause.closedAt ? [{ at: cause.closedAt, icon: "🔒", text: "Closed", note: cause.closedReason }] : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  // Saved per area; the first visit to a new area looks them up (a second or two).
  const areaReps = await getAreaReps(cause);
  // A campaign starts out addressed to the actual person when we know them.
  const fixerLevel = cause.fixer === "city" ? "municipal" : cause.fixer === "province" ? "provincial" : cause.fixer === "federal" ? "federal" : null;
  const rep = fixerLevel && areaReps ? leadRep(areaReps.reps, fixerLevel) : null;
  const campaignTarget = rep
    ? repTarget(rep)
    : !fixerLevel && cause.contactName
      ? [cause.contactName, cause.contactRole].filter(Boolean).join(", ")
      : campaignTargetFor(cause.fixer, cause.fixerOther, cause.country, cause.placeName);

  return (
    <div className="space-y-6">
      <Panel>
        <p className="whitespace-pre-line text-[17px] leading-relaxed">{cause.description}</p>
      </Panel>

      <WhoCanFix cause={cause} areaReps={areaReps} isLeader={canEditCause(cause, user?.id)} />

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

          {!active ? null : user ? (
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-medium text-link">
                + {cause.campaigns.length ? "Start another campaign" : "Start a campaign"}
              </summary>
              <div className="mt-4">
                <CampaignForm causeId={cause.id} defaultTarget={campaignTarget} />
              </div>
            </details>
          ) : (
            <SignInPrompt next={`/causes/${cause.id}`} text="start a campaign" />
          )}
        </div>
      </Panel>

      {timeline.length > 0 && (
        <Panel title="Timeline" id="timeline">
          <ol className="space-y-3 text-sm">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="w-5 shrink-0 text-center">
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block">{t.text}</span>
                  {t.note && <span className="block text-muted">&ldquo;{t.note}&rdquo;</span>}
                  <span className="block text-xs text-muted">
                    <LocalTime iso={t.at.toISOString()} options={{ month: "short", day: "numeric", year: "numeric" }} />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {leads ? (
          <div className="w-full space-y-3">
          {active && (
            <>
              {cause.winProposal ? (
                <form action={withdrawWin} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="proposalId" value={cause.winProposal.id} />
                  <span>
                    You proposed a win: {cause.winProposal.confirmed} of {cause.winProposal.needed} confirmations so far.
                  </span>
                  <button className="text-xs text-muted underline hover:text-foreground">Withdraw it</button>
                </form>
              ) : (
                <ProposeWinForm causeId={cause.id} />
              )}
              <LogContactForm causeId={cause.id} suggestedWho={campaignTarget} />
              {cause.actions.some((a) => a.kind === "contacted") && <LogReplyForm causeId={cause.id} />}
              <CloseCauseForm causeId={cause.id} />
            </>
          )}
          <FixerChangeForm causeId={cause.id} country={cause.country} fixer={cause.fixer} fixerOther={cause.fixerOther} />
          {canEditCause(cause, user?.id) && <EditCauseForm causeId={cause.id} title={cause.title} description={cause.description} />}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-foreground">
              Co-leaders{coLeads.length > 0 ? ` (${coLeads.length} of ${MAX_CO_LEADERS})` : ""}
            </summary>
            <div className="mt-3 max-w-xl space-y-3">
              <p className="text-muted">
                Up to {MAX_CO_LEADERS} members can share leading this cause. Co-leaders can do everything here except hand it over or
                choose co-leaders. It counts toward their {MAX_LEADING_CAUSES} active causes.
              </p>
              {coLeads.length > 0 && (
                <ul className="space-y-2">
                  {coLeads.map((c) => (
                    <li key={c.userId} className="flex flex-wrap items-center gap-3">
                      <span>
                        <strong>{displayName(c.user)}</strong>
                        {!c.acceptedAt && <span className="text-muted"> · invited, waiting for an answer</span>}
                      </span>
                      {(isLeader || c.userId === user?.id) && (
                        <form action={removeCoLeader}>
                          <input type="hidden" name="causeId" value={cause.id} />
                          <input type="hidden" name="userId" value={c.userId} />
                          <button className="text-xs text-muted underline hover:text-foreground">
                            {c.userId === user?.id ? "Step down as co-leader" : c.acceptedAt ? "Remove" : "Withdraw the invite"}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isLeader && active && coLeadSpaces > 0 && (
                <CoLeaderInviteForm causeId={cause.id} members={handOverTo.filter((m) => !coLeads.some((c) => c.userId === m.id))} />
              )}
            </div>
          </details>
          {isLeader && (
          <details className="text-sm" open={!!pendingOffer}>
            <summary className="cursor-pointer text-muted hover:text-foreground">Hand over leading this cause</summary>
            <div className="mt-3 max-w-xl space-y-3">
              {pendingOffer ? (
                <form action={withdrawLeadOffer} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="offerId" value={pendingOffer.id} />
                  <span>
                    Waiting for <strong>{pendingOffer.to.name}</strong> to accept (until{" "}
                    <LocalTime iso={pendingOfferUntil!.toISOString()} options={{ month: "short", day: "numeric" }} />
                    ).
                  </span>
                  <button className="text-xs text-muted underline hover:text-foreground">Withdraw the offer</button>
                </form>
              ) : (
                <HandOverForm causeId={cause.id} members={handOverTo} />
              )}
            </div>
          </details>
          )}
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
