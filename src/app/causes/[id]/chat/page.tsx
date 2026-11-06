import { Fragment, Suspense } from "react";
import { ChatShell, DayDivider, MessageActions } from "@/components/chat-shell";
import { startsGroup } from "@/lib/chat-days";
import { getCurrentUser } from "@/lib/auth";
import { getCauseDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { CHAT_COOLING_OFF_HOURS, chatAccess } from "@/lib/chat-rules";
import { chatPass } from "@/lib/live-chat";
import { LiveChat } from "@/components/live-chat";
import { toggleMembership } from "@/app/actions/community";
import { LocalTime } from "@/components/local-time";
import { CommentForm } from "@/components/cause-forms";
import { canEditMessage } from "@/lib/editing";
import { leadsCause } from "@/lib/leadership";
import { Panel, RemovedNotice, SignInPrompt } from "@/components/cause-parts";
import { buttonStyles } from "@/components/styles";

// The cause's conversation. Members only (see src/lib/chat-rules.ts): join to
// read along; post once you've been a member for 24 hours.
export default function ChatTab(props: PageProps<"/causes/[id]/chat">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-border/60" />}>
      <Chat params={props.params} />
    </Suspense>
  );
}

async function Chat({ params }: Pick<PageProps<"/causes/[id]/chat">, "params">) {
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
            ) : (
              <form action={toggleMembership}>
                <input type="hidden" name="causeId" value={cause.id} />
                <button className={buttonStyles.primary}>Join this cause</button>
              </form>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  // Only people who can read the chat get a pass to listen for new messages.
  const pass = await chatPass(cause.id);

  const comments = cause.comments;
  const last = comments.at(-1);

  return (
    <ChatShell
      backHref={`/causes/${cause.id}`}
      title={cause.title}
      lastId={last?.id ?? null}
      lastMine={!!last && last.author.id === user?.id}
      status={<LiveChat pass={pass} />}
      composer={
        <ChatComposer
          closed={cause.stage === "closed"}
          access={access}
          causeId={cause.id}
          moderatorReading={!!user?.isAdmin && !cause.viewerJoinedAt}
        />
      }
    >
      <ol aria-label="Messages">
        {comments.map((c, i) => {
          const prev = i > 0 ? comments[i - 1] : null;
          const mine = c.author.id === user?.id;
          const first = startsGroup(prev && { authorId: prev.author.id, createdAt: prev.createdAt, removed: !!prev.removedAt }, { authorId: c.author.id, createdAt: c.createdAt });
          const role =
            c.author.id === cause.leaderId ? "leads this" : leadsCause(cause, c.author.id) ? "co-leads this" : c.author.id === cause.authorId ? "started this" : null;
          const bubble = (
            <div
              className={`min-w-0 whitespace-pre-line break-words rounded-2xl border px-3 py-1.5 text-left text-[15px] leading-relaxed ${
                mine ? "rounded-br-md border-sage/60 bg-sage/25" : "rounded-bl-md border-border bg-surface lg:bg-background"
              } ${c.hidden ? "text-muted" : ""}`}
            >
              {c.body}
              <span className="ml-2 inline-block translate-y-0.5 whitespace-nowrap text-[11px] text-muted">
                <LocalTime iso={c.createdAt.toISOString()} options={{ hour: "numeric", minute: "2-digit" }} />
                {c.editedAt && " · edited"}
              </span>
            </div>
          );
          return (
            <Fragment key={c.id}>
              <DayDivider iso={c.createdAt.toISOString()} prevIso={prev ? prev.createdAt.toISOString() : null} />
              <li className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-3" : "mt-0.5"}`} data-message>
                <div className={`flex max-w-[88%] flex-col sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                  {first && !mine && (
                    <p className="mb-0.5 px-1 text-xs text-muted">
                      <span className={`font-semibold ${c.author.deactivatedAt ? "" : "text-foreground"}`}>{displayName(c.author)}</span>
                      {role && <span className="ml-1">· {role}</span>}
                    </p>
                  )}
                  <MessageActions
                    commentId={c.id}
                    body={c.body}
                    mine={mine}
                    canEdit={canEditMessage({ ...c, authorId: c.author.id }, user?.id)}
                    canReport={!!user?.emailVerified && !mine}
                  >
                    {bubble}
                  </MessageActions>
                  {c.removedAt ? (
                    <div className="mt-2 text-left">
                      <RemovedNotice what="message" removedAt={c.removedAt} reason={c.removalReason} />
                    </div>
                  ) : (
                    c.hidden && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Hidden after reports. Only you can see it while it&apos;s reviewed.</p>
                  )}
                </div>
              </li>
            </Fragment>
          );
        })}
        {comments.length === 0 && <li className="py-6 text-center text-sm text-muted">No messages yet. Say hello!</li>}
      </ol>
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
