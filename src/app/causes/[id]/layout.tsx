import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCauseForShare } from "@/lib/queries";
import { causeShare } from "@/lib/share-meta";
import { removeCover } from "@/app/actions/media";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCategory } from "@/lib/categories";
import { askingWhom, fixerEmoji } from "@/lib/fixers";
import { coLeadInviteOpen, leadershipLine, leadsCause, offerOpen } from "@/lib/leadership";
import { areaHref } from "@/lib/countries";
import { getActiveLedCauses, getCauseDetail } from "@/lib/queries";
import { canLeadAnother, MAX_LEADING_CAUSES } from "@/lib/leading-limit";
import { displayName } from "@/lib/accounts";
import { peopleLine } from "@/lib/momentum";
import { canReadChat, chatAccess } from "@/lib/chat-rules";
import { answerCoLeadInvite, answerLeadOffer, confirmWin, leaveCauseAction, reopenCause, stillGoing, toggleMembership } from "@/app/actions/community";
import { canReopen, isActive } from "@/lib/stages";
import { StageTracker } from "@/components/stage-tracker";
import { RelativeTime } from "@/components/local-time";
import { ShareButton } from "@/components/cause-forms";
import { SourceTag } from "@/components/source-tag";
import { taggedUrl } from "@/lib/sources";
import { CauseTabs } from "@/components/cause-tabs";
import { RemovedNotice } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

// The tab title and the preview card when the link is shared in WhatsApp,
// iMessage, Facebook… (the image is opengraph-image.tsx next to this file).
export async function generateMetadata({ params }: LayoutProps<"/causes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = await getCauseForShare(id);
  const share = c && causeShare(c);
  if (!share) return { title: "Cause", robots: { index: false } };
  return {
    title: share.title,
    description: share.description,
    openGraph: { title: share.title, description: share.description, type: "website", url: `/causes/${id}` },
    twitter: { card: "summary_large_image", title: share.title, description: share.description },
  };
}

// A cause is a small space: this header (what it is, who's in, Join) sits
// above its three tabs — About, Chat and Events.
export default function CauseLayout({ children, params }: LayoutProps<"/causes/[id]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-border/60" />}>
        <CauseHeader params={params}>{children}</CauseHeader>
      </Suspense>
    </div>
  );
}

// Fixed light fills (not theme colours), so the dark initials stay readable in dark mode too.
const AVATAR_COLOURS = ["bg-[#e9b44c]", "bg-[#a9c4b2]", "bg-[#f0c9b8]"];

async function CauseHeader({ params, children }: { params: LayoutProps<"/causes/[id]">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cause = await getCauseDetail(id, user?.id ?? null);
  if (!cause || (cause.hidden && cause.authorId !== user?.id)) notFound();

  if (cause.removedAt) {
    // Only the author gets here. Show what was removed and why, nothing more.
    return (
      <article>
        <RemovedNotice what="cause" removedAt={cause.removedAt} reason={cause.removalReason} />
        <h1 className="mt-6 text-3xl font-semibold">{cause.title}</h1>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-muted">{cause.description}</p>
        <Link href="/me" className="mt-6 inline-block text-sm text-link underline">
          ← Your activity
        </Link>
      </article>
    );
  }

  const cat = getCategory(cause.category);
  const place = `${cause.placeName}, ${cause.region}`;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const access = chatAccess({
    signedIn: !!user,
    isAdmin: user?.isAdmin,
    isLeader: leadsCause(cause, user?.id),
    joinedAt: cause.viewerJoinedAt,
    emailVerified: user?.emailVerified,
  });
  const upcomingEvents = cause.meetups.filter((m) => m.upcoming).length;
  const asking = askingWhom(cause.fixer, cause.fixerOther, cause.country);
  const latestOffer = cause.leadOffers[0];
  const offerForMe = user && latestOffer?.toUserId === user.id && offerOpen(latestOffer) ? latestOffer : null;
  const coLeadInvite = user ? cause.coLeaders.find((c) => c.userId === user.id && coLeadInviteOpen(c)) : undefined;
  // The leader or a co-leader: they get the leader banners and tools.
  const leads = leadsCause(cause, user?.id);
  const coLeaderNames = cause.coLeaders.filter((c) => c.acceptedAt && !c.user.deactivatedAt).map((c) => c.user.name);
  // Taking on a cause (a hand-over, a co-lead invite, reopening) respects the leading limit,
  // unless it's one they already help lead.
  const reopenable = leads && cause.stage === "closed" && canReopen(cause.closedAt);
  const atLimit =
    user && (offerForMe || coLeadInvite || reopenable) && !(leads && !reopenable)
      ? !canLeadAnother((await getActiveLedCauses(user.id)).length, user.isAdmin)
      : false;

  return (
    <article>
      {/* A flyer or post brings people here tagged (#67); remember it until they join. */}
      <SourceTag ids={[cause.id]} />
      <Link href={areaHref(cause.country, cause.postalCode)} className="text-sm text-muted hover:text-foreground">
        ← Around {place}
      </Link>

      {cause.hidden && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This cause was hidden after community reports and is only visible to you while it&apos;s reviewed.
        </p>
      )}

      {offerForMe && (
        <form action={answerLeadOffer} className="mt-4 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-ink bg-mustard/25 p-3 text-sm">
          <input type="hidden" name="offerId" value={offerForMe.id} />
          <span className="min-w-0 flex-1">
            <strong>{offerForMe.from.name}</strong> has asked you to lead this cause. You&apos;d be able to edit it, move it forward and
            organize around it.
            {atLimit && (
              <span className="mt-1 block">
                You&apos;re already leading {MAX_LEADING_CAUSES} active causes, the most at once. To accept, finish one first (mark it won,
                close it, or hand it over), or decline.
              </span>
            )}
          </span>
          {!atLimit && (
            <button name="answer" value="accept" className={`${buttonStyles.primary} !px-3 !py-1.5`}>
              Accept
            </button>
          )}
          <button name="answer" value="decline" className={`${buttonStyles.secondary} !px-3 !py-1.5`}>
            Decline
          </button>
        </form>
      )}

      {coLeadInvite && (
        <form action={answerCoLeadInvite} className="mt-4 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-ink bg-mustard/25 p-3 text-sm">
          <input type="hidden" name="causeId" value={cause.id} />
          <span className="min-w-0 flex-1">
            <strong>{displayName(cause.leader)}</strong> has asked you to co-lead this cause. You&apos;d share leading it: editing it,
            moving it forward and organizing around it.
            {atLimit && (
              <span className="mt-1 block">
                You&apos;re already leading {MAX_LEADING_CAUSES} active causes, the most at once (co-leading counts). To accept, finish one
                first, or decline.
              </span>
            )}
          </span>
          {!atLimit && (
            <button name="answer" value="accept" className={`${buttonStyles.primary} !px-3 !py-1.5`}>
              Accept
            </button>
          )}
          <button name="answer" value="decline" className={`${buttonStyles.secondary} !px-3 !py-1.5`}>
            Decline
          </button>
        </form>
      )}

      {cause.stage === "closed" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed border-ink p-3 text-sm">
          <span className="min-w-0 flex-1">
            <strong>Closed</strong>
            {cause.closedAt && (
              <>
                {" "}
                <RelativeTime iso={cause.closedAt.toISOString()} />
              </>
            )}
            {cause.closedReason && <>: {cause.closedReason.replace(/[.!\s]+$/, "")}</>}. You can still read everything here.
          </span>
          {reopenable && atLimit && (
            <span className="text-xs text-muted">To reopen it, finish one of the {MAX_LEADING_CAUSES} causes you&apos;re leading first.</span>
          )}
          {reopenable && !atLimit && (
            <form action={reopenCause}>
              <input type="hidden" name="causeId" value={cause.id} />
              <button className={`${buttonStyles.secondary} !px-3 !py-1.5`}>Reopen</button>
            </form>
          )}
        </div>
      )}

      {leads && cause.quietAskedAt && isActive(cause.stage) && (
        <form action={stillGoing} className="mt-4 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-ink bg-mustard/25 p-3 text-sm">
          <input type="hidden" name="causeId" value={cause.id} />
          <span className="min-w-0 flex-1">
            It&apos;s been quiet here for a while. <strong>Is this cause still going?</strong> If nobody answers within two weeks, it closes
            as &quot;went quiet&quot;.
          </span>
          <button className={`${buttonStyles.primary} !px-3 !py-1.5`}>Yes, still going</button>
        </form>
      )}

      {cause.winProposal && isActive(cause.stage) && (
        <div className="mt-4 rounded-md border-[1.5px] border-ink bg-sage/25 p-3 text-sm" id="win">
          <p>
            <strong>{cause.winProposal.proposedBy.name}</strong> says it&apos;s fixed: &ldquo;{cause.winProposal.note}&rdquo;
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {cause.viewerIsMember && user?.id !== cause.winProposal.proposedById && !cause.winProposal.viewerConfirmed ? (
              <form action={confirmWin}>
                <input type="hidden" name="proposalId" value={cause.winProposal.id} />
                <button className={`${buttonStyles.primary} !px-3 !py-1.5`}>Yes, it&apos;s fixed</button>
              </form>
            ) : cause.winProposal.viewerConfirmed ? (
              <span className="font-medium">✓ You confirmed</span>
            ) : null}
            <span className="text-muted">
              {cause.winProposal.confirmed} of {cause.winProposal.needed} confirmations from members
            </span>
          </div>
        </div>
      )}

      {cause.coverUrl && (
        <figure className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- already resized; served straight from storage */}
          <img
            src={cause.coverUrl}
            alt={cause.coverAlt ?? `Cover image for ${cause.title}`}
            className="aspect-video max-h-80 w-full rounded-md border-[1.5px] border-ink object-cover"
          />
          {user?.isAdmin && !leads && (
            // Moderators can take down any image; the people leading it change it on About.
            <form action={removeCover} className="mt-1 text-right">
              <input type="hidden" name="target" value="cause" />
              <input type="hidden" name="id" value={cause.id} />
              <button className="text-xs text-muted underline hover:text-red-600">Remove image (moderator)</button>
            </form>
          )}
        </figure>
      )}

      <header className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-muted">
          {cat.emoji} {cat.label} · {cause.placeName} ·{" "}
          {leadershipLine(displayName(cause.author), displayName(cause.leader), cause.authorId === cause.leaderId, coLeaderNames)} ·{" "}
          <RelativeTime iso={cause.createdAt.toISOString()} />
          {cause.editedAt && " · edited"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{cause.title}</h1>
        <p className="mt-2 text-sm">
          <span aria-hidden="true">{fixerEmoji(cause.fixer, cause.country)} </span>
          {asking ? (
            <>
              Asking: <strong>{asking}</strong>
            </>
          ) : (
            <span className="text-muted">Who should fix it? Not sure yet. Know who? Tell the group in the chat.</span>
          )}
        </p>
        <StageTracker stage={cause.stage} members={cause._count.members} forLeader={leads} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            {cause.memberNames.length > 0 && (
              <span className="flex" aria-hidden="true">
                {cause.memberNames.slice(0, 3).map((name, i) => (
                  <span
                    key={i}
                    className={`-mr-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-background text-[11px] font-semibold text-[#1f2a44] ${AVATAR_COLOURS[i]}`}
                  >
                    {name[0]?.toUpperCase()}
                  </span>
                ))}
              </span>
            )}
            <span className={cause.memberNames.length > 0 ? "ml-1.5" : ""}>
              {peopleLine(cause.memberNames, cause._count.members, "joined")}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!user ? (
              cause.stage === "closed" ? null : (
                <Link href={`/signin?next=${encodeURIComponent(`/causes/${cause.id}`)}`} className={buttonStyles.primary}>
                  Join this cause
                </Link>
              )
            ) : cause.viewerIsMember ? (
              <>
                <span className={buttonStyles.selected}>✓ Joined</span>
                {/* The leader hands the cause over before leaving (About → Hand over leading this cause). */}
                {user.id !== cause.leaderId && (
                <details className="relative text-xs">
                  <summary className="cursor-pointer px-1 text-muted hover:text-foreground">Leave</summary>
                  <form
                    action={leaveCauseAction}
                    className="fixed inset-x-4 top-28 z-30 mx-auto max-w-sm space-y-2 rounded-md border-[1.5px] border-ink bg-surface p-3 shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-72"
                  >
                    <input type="hidden" name="causeId" value={cause.id} />
                    <p className="text-muted">
                      Leaving removes your support, your RSVPs to its upcoming events and your campaign signatures, and you won&apos;t
                      see the chat. Your messages stay. Events you host pass to the next person going.
                    </p>
                    <button className={`${buttonStyles.secondary} !px-3 !py-1 text-xs`}>Leave this cause</button>
                  </form>
                </details>
                )}
              </>
            ) : cause.stage === "closed" ? null : (
              <form action={toggleMembership}>
                <input type="hidden" name="causeId" value={cause.id} />
                <button className={buttonStyles.primary}>Join this cause</button>
              </form>
            )}
            <ShareButton url={taggedUrl(`${appUrl}/causes/${cause.id}`, "link")} title={cause.title} />
          </div>
        </div>
      </header>

      <CauseTabs id={cause.id} chatLocked={!canReadChat(access)} messages={cause._count.comments} events={upcomingEvents} />
      <div className="mt-6">{children}</div>
    </article>
  );
}
