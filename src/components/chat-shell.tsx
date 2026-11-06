"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { editComment, reportContent } from "@/app/actions/community";
import { hideMessage, unhideMessage } from "@/app/actions/leader-moderation";
import { RemoveMemberForm } from "./remove-member";
import type { FormState } from "@/lib/forms";
import { dayLabel } from "@/lib/chat-days";
import { FormError, SubmitButton, inputStyles, useFormAction } from "./ui";
import { Honeypot } from "./bot-check";

// A cause's chat that feels like a group chat (#70). On a phone it fills the
// screen: a one-line header (back and title), the messages scrolling on their
// own, and the message box pinned to the bottom, above the keyboard. On a
// computer it's a roomy panel. It opens at the newest message and stays there
// as new ones arrive, unless you've scrolled up: then "New messages ↓" appears.

const NEAR_BOTTOM_PX = 80;
const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

export function ChatShell({
  backHref,
  title,
  lastId,
  lastMine,
  status,
  pinned,
  composer,
  children,
}: {
  backHref: string;
  title: string;
  /** The newest message: when it changes, there's something new. */
  lastId: string | null;
  /** The newest message is the viewer's own (they just sent it): always go to it. */
  lastMine: boolean;
  status?: React.ReactNode;
  /** An announcement pinned above the messages (#73). */
  pinned?: React.ReactNode;
  composer: React.ReactNode;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [bottom, setBottom] = useState(true);
  const [seenId, setSeenId] = useState(lastId);

  const toBottom = (smooth = false) => {
    const s = scroller.current;
    if (s) s.scrollTo({ top: s.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Open at the newest message, and stay there while things settle in (day
  // separators and the live line appear after loading, images, a growing box).
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    toBottom();
    const el = content.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) toBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Something new: follow it if they were at the bottom (or sent it themselves).
  useLayoutEffect(() => {
    if (atBottom.current || lastMine) toBottom();
  }, [lastId, lastMine]);

  // On a phone: fill the screen, and stay above the on-screen keyboard (it shrinks the visual viewport).
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023px)");
    const vv = window.visualViewport;
    const html = document.documentElement;
    const fit = () => {
      const el = root.current;
      if (!el) return;
      if (!phone.matches) {
        el.style.height = "";
        el.style.transform = "";
        html.style.overflow = "";
        return;
      }
      html.style.overflow = "hidden"; // the page behind doesn't scroll
      if (vv) {
        el.style.height = `${vv.height}px`;
        el.style.transform = `translateY(${vv.offsetTop}px)`;
      }
      if (atBottom.current) toBottom();
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    phone.addEventListener("change", fit);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      phone.removeEventListener("change", fit);
      html.style.overflow = "";
    };
  }, []);

  const onScroll = () => {
    const s = scroller.current;
    if (!s) return;
    atBottom.current = s.scrollHeight - s.scrollTop - s.clientHeight < NEAR_BOTTOM_PX;
    if (atBottom.current !== bottom) setBottom(atBottom.current);
    if (atBottom.current && seenId !== lastId) setSeenId(lastId);
  };

  return (
    <div
      ref={root}
      data-chat
      className="flex flex-col bg-background max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-50 max-lg:h-dvh lg:h-[min(75vh,820px)] lg:overflow-hidden lg:rounded-md lg:border-[1.5px] lg:border-ink lg:bg-surface"
    >
      <header className="flex items-center gap-2 border-b-[1.5px] border-ink px-2 py-2 lg:hidden">
        <Link href={backHref} aria-label="Back to the cause" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-lg hover:bg-surface">
          ←
        </Link>
        <span className="min-w-0 flex-1 truncate font-display text-base font-semibold">{title}</span>
      </header>
      {pinned}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-3 py-3 lg:px-5" data-chat-scroll>
          <div ref={content}>
            {status}
            {children}
          </div>
        </div>
        {seenId !== lastId && !bottom && (
          <button
            type="button"
            onClick={() => toBottom(true)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border-[1.5px] border-ink bg-mustard px-3 py-1 text-xs font-semibold text-[#1f2a44] shadow"
          >
            New messages ↓
          </button>
        )}
      </div>
      <div className="border-t border-border bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:bg-surface lg:px-5 lg:py-3">{composer}</div>
    </div>
  );
}

/** "Today", "Yesterday", "Tuesday"… between days, in the viewer's own time zone (so drawn in the browser). */
export function DayDivider({ iso, prevIso }: { iso: string; prevIso: string | null }) {
  const inBrowser = useInBrowser();
  if (!inBrowser) return null;
  const label = dayLabel(new Date(iso), prevIso ? new Date(prevIso) : null, new Date());
  if (!label) return null;
  return (
    <li role="separator" aria-label={label} className="my-3 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-border" />
      <span className="font-medium">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </li>
  );
}

/**
 * A message with its small "⋯" menu (#70): Edit (your own, for 15 minutes)
 * and Report (someone else's). Editing opens the message in place.
 */
export function MessageActions({
  commentId,
  body,
  canEdit,
  canReport,
  canHide = false,
  canUnhide = false,
  remove,
  mine,
  children,
}: {
  commentId: string;
  body: string;
  canEdit: boolean;
  canReport: boolean;
  /** For the people leading the cause (#71). */
  canHide?: boolean;
  canUnhide?: boolean;
  remove?: { causeId: string; userId: string; name: string };
  mine: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [state, action] = useFormAction(async (prev: FormState, formData: FormData) => {
    const result = await editComment(prev, formData);
    if (result?.ok) setEditing(false);
    return result;
  });

  if (editing) {
    return (
      <form action={action} className="mt-1 w-full min-w-64 max-w-lg space-y-2 text-left">
        <input type="hidden" name="commentId" value={commentId} />
        <FormError message={state?.error} />
        <textarea name="body" required rows={3} maxLength={3000} defaultValue={state?.values?.body ?? body} aria-label="Edit your message" autoFocus className={inputStyles} />
        <Honeypot />
        <div className="flex items-center gap-2">
          <SubmitButton pendingText="Saving…" className="!px-3 !py-1 text-xs">
            Save
          </SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted underline hover:text-foreground">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (removing && remove) {
    return (
      <div className="space-y-2 rounded-md border-[1.5px] border-ink bg-surface p-3">
        {children}
        <RemoveMemberForm {...remove} onCancel={() => setRemoving(false)} />
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-1 ${mine ? "flex-row-reverse" : ""}`}>
      {children}
      {(canEdit || canReport || canHide || canUnhide || remove) && (
        <details className="relative shrink-0">
          <summary
            aria-label="Message options"
            className="cursor-pointer list-none rounded-md px-1.5 py-1 text-sm leading-none text-muted hover:bg-border/50 hover:text-foreground [&::-webkit-details-marker]:hidden"
          >
            ⋯
          </summary>
          <div className={`absolute top-full z-10 mt-1 w-44 rounded-md border-[1.5px] border-ink bg-surface p-1 text-left text-sm shadow-lg ${mine ? "right-0" : "left-0"}`}>
            {canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-border/50">
                Edit
              </button>
            )}
            {canHide && (
              <form action={hideMessage}>
                <input type="hidden" name="commentId" value={commentId} />
                <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-border/50">Hide</button>
              </form>
            )}
            {canUnhide && (
              <form action={unhideMessage}>
                <input type="hidden" name="commentId" value={commentId} />
                <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-border/50">Unhide</button>
              </form>
            )}
            {remove && (
              <button type="button" onClick={() => setRemoving(true)} className="block w-full rounded px-2 py-1.5 text-left text-red-700 hover:bg-border/50 dark:text-red-400">
                Remove from this cause
              </button>
            )}
            {canReport && (
              <form action={reportContent}>
                <input type="hidden" name="targetType" value="comment" />
                <input type="hidden" name="targetId" value={commentId} />
                <button className="block w-full rounded px-2 py-1.5 text-left text-red-700 hover:bg-border/50 dark:text-red-400">Report</button>
              </form>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
