import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCauseDetail } from "@/lib/queries";
import { displayName } from "@/lib/accounts";
import { CHAT_COOLING_OFF_HOURS, chatAccess } from "@/lib/chat-rules";
import { chatPass } from "@/lib/live-chat";
import { LiveChat } from "@/components/live-chat";
import { reportContent, toggleMembership } from "@/app/actions/community";
import { LocalTime } from "@/components/local-time";
import { CommentForm } from "@/components/cause-forms";
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

  const isAuthor = user?.id === cause.authorId;
  const access = chatAccess({
    signedIn: !!user,
    isAdmin: user?.isAdmin,
    isAuthor,
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

  return (
    <Panel>
      <LiveChat pass={pass} />
      <ol className="space-y-3" aria-label="Messages">
        {cause.comments.map((c) => {
          const mine = c.author.id === user?.id;
          return (
            <li key={c.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] ${mine ? "text-right" : ""}`}>
                <p className="mb-1 text-xs text-muted">
                  <span className={`font-semibold ${c.author.deactivatedAt ? "" : "text-foreground"}`}>{mine ? "You" : displayName(c.author)}</span>
                  {c.author.id === cause.authorId && !mine && <span className="ml-1">· started this</span>}
                  <span className="ml-1.5">
                    <LocalTime iso={c.createdAt.toISOString()} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                  </span>
                  {user?.emailVerified && !mine && (
                    <form action={reportContent} className="ml-2 inline opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <input type="hidden" name="targetType" value="comment" />
                      <input type="hidden" name="targetId" value={c.id} />
                      <button className="text-xs text-muted underline hover:text-red-600">Report</button>
                    </form>
                  )}
                </p>
                <p
                  className={`inline-block whitespace-pre-line rounded-lg border px-3 py-2 text-left text-sm leading-relaxed ${
                    mine ? "border-sage/60 bg-sage/20" : "border-border bg-background"
                  } ${c.hidden ? "text-muted" : ""}`}
                >
                  {c.body}
                </p>
                {c.removedAt ? (
                  <div className="mt-2 text-left">
                    <RemovedNotice what="message" removedAt={c.removedAt} reason={c.removalReason} />
                  </div>
                ) : (
                  c.hidden && (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Hidden after reports. Only you can see it while it&apos;s reviewed.</p>
                  )
                )}
              </div>
            </li>
          );
        })}
        {cause.comments.length === 0 && <li className="py-6 text-center text-sm text-muted">No messages yet.</li>}
      </ol>

      <div className="mt-6 border-t border-border pt-4">
        {access.kind === "post" ? (
          <CommentForm causeId={cause.id} />
        ) : access.kind === "verify-email" ? (
          <p className="text-sm text-muted">Confirm your email address to post. Check your inbox for the link.</p>
        ) : user?.isAdmin && !cause.viewerJoinedAt ? (
          <p className="text-sm text-muted">You&apos;re reading as a moderator. Join the cause to take part.</p>
        ) : (
          <p className="flex items-start gap-2 rounded-md border-[1.5px] border-dashed border-ink p-3 text-sm">
            <span aria-hidden="true">⏳</span>
            <span>
              Welcome! New members read along for their first {CHAT_COOLING_OFF_HOURS} hours, to get to know everyone (and to keep
              spam bots out). You can post from{" "}
              <strong>
                <LocalTime iso={access.canPostAt.toISOString()} options={{ weekday: "long", hour: "numeric", minute: "2-digit" }} />
              </strong>
            </span>
          </p>
        )}
      </div>
    </Panel>
  );
}
