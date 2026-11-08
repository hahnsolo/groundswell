import { Suspense } from "react";
import { ChatShell } from "@/components/chat-shell";
import { ChatMessages } from "@/components/chat-messages";
import Link from "next/link";
import { CHAT_PAGE, MAX_CHAT_SHOWN, messagesToShow } from "@/lib/chat-days";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCauseDetail, getCauseMessages } from "@/lib/queries";
import { chatMessageView } from "@/lib/chat-view";
import { CHAT_COOLING_OFF_HOURS, chatAccess } from "@/lib/chat-rules";
import { chatPass } from "@/lib/live-chat";
import { LiveChat } from "@/components/live-chat";
import { reportContent, toggleMembership } from "@/app/actions/community";
import { unpinAnnouncement } from "@/app/actions/announcements";
import { LocalTime } from "@/components/local-time";
import { CommentForm } from "@/components/cause-forms";
import { leadsCause } from "@/lib/leadership";
import { Panel, SignInPrompt } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

// The cause's conversation. Members only (see src/lib/chat-rules.ts): join to
// read along; post once you've been a member for 24 hours.
export default function ChatTab(props: PageProps<"/causes/[id]/chat">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-border/60" />}>
      <Chat params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Chat({ params, searchParams }: Pick<PageProps<"/causes/[id]/chat">, "params" | "searchParams">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cause = await getCauseDetail(id, user?.id ?? null);
  if (!cause || cause.removedAt || (cause.hidden && cause.authorId !== user?.id)) return null; // the layout explains

  const access = chatAccess({
    signedIn: !!user,
    isAdmin: user?.isAdmin,
    isLeader: leadsCause(cause, user?.id),
    joinedAt: cause.viewerJoinedAt,
    emailVerified: user?.emailVerified,
  });
  const count = cause._count.comments;
  const talking = count === 0 ? "This is where neighbours talk it through." : `${count} message${count === 1 ? "" : "s"} from neighbours so far.`;

  if (access.kind === "sign-in" || access.kind === "join") {
    return (
      <Panel>
        <div className="py-6 text-center">
          <p className="font-display text-xl font-semibold">The chat is for neighbours who&apos;ve joined</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {talking} Join this cause to read along. You can start posting a day after joining.
          </p>
          <div className="mt-5">
            {access.kind === "sign-in" ? (
              <SignInPrompt next={`/causes/${cause.id}/chat`} text="join" />
            ) : cause.viewerRemoval ? (
              <p className="text-sm text-muted">The people leading this cause removed you from it, so you can&apos;t rejoin.</p>
            ) : (
              <form action={toggleMembership}>
                <input type="hidden" name="causeId" value={cause.id} />
                <button className={buttonStyles.primary}>Join this cause</button>
                <p className="mt-2 text-xs text-muted">The people leading this cause can see that you joined.</p>
              </form>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  // Only people who can read the chat get a pass to listen for new messages.
  const pass = await chatPass(cause.id);

  const shown = messagesToShow((await searchParams).show);
  const { messages: comments, hasEarlier } = await getCauseMessages(cause.id, user?.id ?? null, shown);
  const last = comments.at(-1);
  const viewerLeads = leadsCause(cause, user?.id);
  const pinned = cause.announcements[0];
  const reportedPinned =
    !!pinned && !!user && !!(await db.report.findUnique({ where: { targetType_targetId_reporterId: { targetType: "announcement", targetId: pinned.id, reporterId: user.id } }, select: { id: true } }));

  return (
    <ChatShell
      backHref={`/causes/${cause.id}`}
      title={cause.title}
      lastId={last?.id ?? null}
      lastMine={!!last && last.author.id === user?.id}
      status={<LiveChat pass={pass} />}
      pinned={
        pinned && (
          <aside aria-label="Announcement" className="max-h-36 overflow-y-auto border-b border-border bg-mustard/20 px-3 py-2 text-sm lg:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              📌 Announcement · {pinned.author.deactivatedAt ? "the people leading this" : pinned.author.name} · <LocalTime iso={pinned.createdAt.toISOString()} options={{ month: "short", day: "numeric" }} />
            </p>
            <p className="mt-0.5 whitespace-pre-line break-words">{pinned.body}</p>
            {viewerLeads && (
              <form action={unpinAnnouncement} className="mt-1">
                <input type="hidden" name="announcementId" value={pinned.id} />
                <button className="text-xs text-muted underline hover:text-foreground">Unpin</button>
              </form>
            )}
            {reportedPinned ? (
              <p className="mt-1 text-xs text-muted">You reported this. A moderator will take a look.</p>
            ) : user?.emailVerified && pinned.authorId !== user.id && (
              <form action={reportContent} className="mt-1">
                <input type="hidden" name="targetType" value="announcement" />
                <input type="hidden" name="targetId" value={pinned.id} />
                <button className="text-xs text-muted underline hover:text-red-600">Report this announcement</button>
              </form>
            )}
          </aside>
        )
      }
      composer={
        <ChatComposer
          closed={cause.stage === "closed"}
          access={access}
          causeId={cause.id}
          moderatorReading={!!user?.isAdmin && !cause.viewerJoinedAt}
        />
      }
    >
      {hasEarlier && shown < MAX_CHAT_SHOWN && (
        <p className="mb-3 text-center">
          <Link href={`/causes/${cause.id}/chat?show=${shown + CHAT_PAGE}`} scroll={false} className="text-sm font-medium text-link underline">
            Show earlier messages
          </Link>
        </p>
      )}
      <ChatMessages causeId={cause.id} messages={comments.map((c) => chatMessageView(c, cause, user))} />
    </ChatShell>
  );
}

/** What goes in the message box's place: the box, or why they can't post yet. */
function ChatComposer({
  closed,
  access,
  causeId,
  moderatorReading,
}: {
  closed: boolean;
  access: ReturnType<typeof chatAccess>;
  causeId: string;
  moderatorReading: boolean;
}) {
  if (closed) return <p className="py-1 text-sm text-muted">This cause is closed, so the chat is read-only.</p>;
  if (access.kind === "post") return <CommentForm causeId={causeId} />;
  if (access.kind === "verify-email") return <p className="py-1 text-sm text-muted">Confirm your email address to post. Check your inbox for the link.</p>;
  if (moderatorReading) return <p className="py-1 text-sm text-muted">You&apos;re reading as a moderator. Join the cause to take part.</p>;
  if (access.kind !== "read") return null;
  return (
    <p className="flex items-start gap-2 rounded-md border-[1.5px] border-dashed border-ink p-2.5 text-sm">
      <span aria-hidden="true">⏳</span>
      <span>
        Welcome! New members read along for their first {CHAT_COOLING_OFF_HOURS} hours, to get to know everyone (and to keep spam bots
        out). You can post from{" "}
        <strong>
          <LocalTime iso={access.canPostAt.toISOString()} options={{ weekday: "long", hour: "numeric", minute: "2-digit" }} />
        </strong>
      </span>
    </p>
  );
}
