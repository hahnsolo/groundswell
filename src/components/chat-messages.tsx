"use client";

import { Fragment, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatLatestContext, DayDivider, MessageActions } from "./chat-shell";
import { RemovedNotice } from "./cause-parts";
import { LocalTime } from "./local-time";
import { startsGroup } from "@/lib/chat-days";
import { HIDDEN_BY_LEADERS } from "@/lib/leader-moderation";
import { withArrivals, type ChatMessageView } from "@/lib/chat-view";

// A cause's chat messages (#101). The page brings the latest ones; when the live
// connection (or the 10-second check) says something changed, this fetches only
// the messages that are new and adds them, instead of reloading the whole page.
// Changes that aren't new messages (an edit, a hide, an announcement) reload the page.

/** Sent by LiveChat. `live`: the live connection said something changed; otherwise it's a routine check. */
export const CHAT_CHANGED_EVENT = "groundswell:chat-changed";
export type ChatChangedDetail = { live: boolean };

/** In check-only mode (no live connection), reload the whole page about once a minute to catch edits and hides. */
const FULL_RELOAD_EVERY_CHECKS = 6;

export function ChatMessages({ causeId, messages }: { causeId: string; messages: ChatMessageView[] }) {
  const router = useRouter();
  const setLatest = useContext(ChatLatestContext);
  const [arrived, setArrived] = useState<ChatMessageView[]>([]);
  const shown = withArrivals(messages, arrived);
  const newest = useRef(shown.at(-1));
  useEffect(() => {
    newest.current = shown.at(-1);
  });
  const busy = useRef(false);
  const again = useRef<ChatChangedDetail | null>(null);
  const checks = useRef(0);

  useEffect(() => {
    // One fetch at a time; a change that comes in meanwhile runs once more afterwards.
    const fetchNew = async (detail: ChatChangedDetail) => {
      if (busy.current) {
        again.current = { live: detail.live || !!again.current?.live };
        return;
      }
      busy.current = true;
      try {
        const last = newest.current;
        if (!last) return router.refresh();
        const res = await fetch(`/causes/${causeId}/chat/messages?after=${encodeURIComponent(last.id)}&at=${encodeURIComponent(last.createdAt)}`, { cache: "no-store" });
        const data = res.ok ? ((await res.json()) as { messages?: ChatMessageView[]; reload?: boolean }) : null;
        if (!data || data.reload || !data.messages) return router.refresh();
        const fresh = data.messages;
        if (fresh.length > 0) {
          setArrived((prev) => withArrivals(prev, fresh));
          const latest = fresh[fresh.length - 1];
          newest.current = latest;
          setLatest(latest.id, latest.mine);
        } else if (detail.live || ++checks.current % FULL_RELOAD_EVERY_CHECKS === 0) {
          // Something changed that isn't a new message.
          router.refresh();
        }
      } catch {
        router.refresh();
      } finally {
        busy.current = false;
        const next = again.current;
        again.current = null;
        if (next) void fetchNew(next);
      }
    };
    const onChanged = (e: Event) => void fetchNew((e as CustomEvent<ChatChangedDetail>).detail ?? { live: true });
    window.addEventListener(CHAT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CHAT_CHANGED_EVENT, onChanged);
  }, [causeId, router, setLatest]);

  return (
    <ol aria-label="Messages">
      {shown.map((c, i) => {
        const prev = i > 0 ? shown[i - 1] : null;
        const first = startsGroup(prev && { authorId: prev.authorId, createdAt: new Date(prev.createdAt), removed: !!prev.removedAt }, { authorId: c.authorId, createdAt: new Date(c.createdAt) });
        const bubble = (
          <div
            className={`min-w-0 whitespace-pre-line break-words rounded-2xl border px-3 py-1.5 text-left text-[15px] leading-relaxed ${
              c.mine ? "rounded-br-md border-sage/60 bg-sage/25" : "rounded-bl-md border-border bg-surface lg:bg-background"
            } ${c.hidden ? "text-muted" : ""} ${c.placeholder ? "italic" : ""}`}
          >
            {c.placeholder ? HIDDEN_BY_LEADERS : c.body}
            <span className="ml-2 inline-block translate-y-0.5 whitespace-nowrap text-[11px] text-muted">
              <LocalTime iso={c.createdAt} options={{ hour: "numeric", minute: "2-digit" }} />
              {c.edited && " · edited"}
            </span>
          </div>
        );
        return (
          <Fragment key={c.id}>
            <DayDivider iso={c.createdAt} prevIso={prev ? prev.createdAt : null} />
            <li className={`flex ${c.mine ? "justify-end" : "justify-start"} ${first ? "mt-3" : "mt-0.5"}`} data-message>
              <div className={`flex max-w-[88%] flex-col sm:max-w-[75%] ${c.mine ? "items-end" : "items-start"}`}>
                {first && !c.mine && (
                  <p className="mb-0.5 px-1 text-xs text-muted">
                    <span className={`font-semibold ${c.deactivated ? "" : "text-foreground"}`}>{c.name}</span>
                    {c.role && <span className="ml-1">· {c.role}</span>}
                  </p>
                )}
                <MessageActions
                  commentId={c.id}
                  body={c.body}
                  mine={c.mine}
                  canEdit={c.canEdit}
                  canReport={c.canReport}
                  canHide={c.canHide}
                  canUnhide={c.canUnhide}
                  remove={c.remove ?? undefined}
                >
                  {bubble}
                </MessageActions>
                {c.removedAt ? (
                  <div className="mt-2 text-left">
                    <RemovedNotice what="message" removedAt={new Date(c.removedAt)} reason={c.removalReason} />
                  </div>
                ) : (
                  c.hidden &&
                  (c.mine || !c.hiddenByLeader) && (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                      {c.hiddenByLeader ? "Hidden by the people leading this cause. Only you can still read it; moderators are reviewing it." : "Hidden after reports. Only you can see it while it's reviewed."}
                    </p>
                  )
                )}
              </div>
            </li>
          </Fragment>
        );
      })}
      {shown.length === 0 && <li className="py-6 text-center text-sm text-muted">No messages yet. Say hello!</li>}
    </ol>
  );
}
