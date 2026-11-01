import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCategory } from "@/lib/categories";
import { askingWhom, fixerEmoji } from "@/lib/fixers";
import { areaHref } from "@/lib/countries";
import { getIssueDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { peopleLine } from "@/lib/momentum";
import { canReadChat, chatAccess } from "@/lib/chat-rules";
import { leaveIssueAction, toggleSupport } from "@/app/actions/community";
import { RelativeTime } from "@/components/local-time";
import { ShareButton } from "@/components/issue-forms";
import { CauseTabs } from "@/components/cause-tabs";
import { RemovedNotice } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

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
  const issue = await getIssueDetail(id, user?.id ?? null);
  if (!issue || (issue.hidden && issue.authorId !== user?.id)) notFound();

  if (issue.removedAt) {
    // Only the author gets here. Show what was removed and why, nothing more.
    return (
      <article>
        <RemovedNotice what="cause" removedAt={issue.removedAt} reason={issue.removalReason} />
        <h1 className="mt-6 text-3xl font-semibold">{issue.title}</h1>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-muted">{issue.description}</p>
        <Link href="/me" className="mt-6 inline-block text-sm text-link underline">
          ← Your activity
        </Link>
      </article>
    );
  }

  const cat = getCategory(issue.category);
  const place = `${issue.placeName}, ${issue.region}`;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const access = chatAccess({
    signedIn: !!user,
    isAdmin: user?.isAdmin,
    isAuthor: user?.id === issue.authorId,
    joinedAt: issue.viewerJoinedAt,
    emailVerified: user?.emailVerified,
  });
  const upcomingEvents = issue.meetups.filter((m) => m.upcoming).length;
  const asking = askingWhom(issue.fixer, issue.fixerOther, issue.country);

  return (
    <article>
      <Link href={areaHref(issue.country, issue.postalCode)} className="text-sm text-muted hover:text-foreground">
        ← Around {place}
      </Link>

      {issue.hidden && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This cause was hidden after community reports and is only visible to you while it&apos;s reviewed.
        </p>
      )}

      <header className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-muted">
          {cat.emoji} {cat.label} · {issue.placeName} · started by {displayName(issue.author)} ·{" "}
          <RelativeTime iso={issue.createdAt.toISOString()} />
          {issue.status === "resolved" && <span className="ml-2 rounded-full bg-sage/30 px-2 py-0.5 font-semibold text-foreground">✓ Won</span>}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{issue.title}</h1>
        <p className="mt-2 text-sm">
          <span aria-hidden="true">{fixerEmoji(issue.fixer, issue.country)} </span>
          {asking ? (
            <>
              Asking: <strong>{asking}</strong>
            </>
          ) : (
            <span className="text-muted">Who should fix it? Not sure yet. Know who? Tell the group in the chat.</span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            {issue.supporterNames.length > 0 && (
              <span className="flex" aria-hidden="true">
                {issue.supporterNames.slice(0, 3).map((name, i) => (
                  <span
                    key={i}
                    className={`-mr-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-background text-[11px] font-semibold text-[#1f2a44] ${AVATAR_COLOURS[i]}`}
                  >
                    {name[0]?.toUpperCase()}
                  </span>
                ))}
              </span>
            )}
            <span className={issue.supporterNames.length > 0 ? "ml-1.5" : ""}>
              {peopleLine(issue.supporterNames, issue._count.supports, "joined")}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!user ? (
              <Link href={`/signin?next=${encodeURIComponent(`/causes/${issue.id}`)}`} className={buttonStyles.primary}>
                Join this cause
              </Link>
            ) : issue.viewerSupports ? (
              <>
                <span className={buttonStyles.selected}>✓ Joined</span>
                <details className="relative text-xs">
                  <summary className="cursor-pointer px-1 text-muted hover:text-foreground">Leave</summary>
                  <form
                    action={leaveIssueAction}
                    className="fixed inset-x-4 top-28 z-30 mx-auto max-w-sm space-y-2 rounded-md border-[1.5px] border-ink bg-surface p-3 shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-72"
                  >
                    <input type="hidden" name="issueId" value={issue.id} />
                    <p className="text-muted">
                      Leaving removes your support, your RSVPs to its upcoming events and your campaign signatures, and you won&apos;t
                      see the chat. Your messages stay. Events you host pass to the next person going.
                    </p>
                    <button className={`${buttonStyles.secondary} !px-3 !py-1 text-xs`}>Leave this cause</button>
                  </form>
                </details>
              </>
            ) : (
              <form action={toggleSupport}>
                <input type="hidden" name="issueId" value={issue.id} />
                <button className={buttonStyles.primary}>Join this cause</button>
              </form>
            )}
            <ShareButton url={`${appUrl}/causes/${issue.id}`} title={issue.title} />
          </div>
        </div>
      </header>

      <CauseTabs id={issue.id} chatLocked={!canReadChat(access)} messages={issue._count.comments} events={upcomingEvents} />
      <div className="mt-6">{children}</div>
    </article>
  );
}
