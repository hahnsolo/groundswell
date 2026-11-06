"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNotificationsRead } from "@/app/actions/notifications";
import { RelativeTime } from "./local-time";

// Your name icon (#95): shows how many notifications are unread, and opens to
// your latest ones and your activity page. Opening them marks them read.

export type NoticeItem = { id: string; title: string; body: string; url: string; createdAt: string; unread: boolean };

export function UserMenu({ name, unread, items }: { name: string; unread: number; items: NoticeItem[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const count = seen ? 0 : unread;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${name}: notifications and your activity${count ? `, ${count} unread` : ""}`}
        title={`${name} · notifications and your activity`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0 && !seen) {
            setSeen(true);
            startTransition(() => markNotificationsRead());
          }
        }}
        className="relative grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-ink bg-mustard text-sm font-semibold text-[#1f2a44] hover:opacity-90"
      >
        {name[0]?.toUpperCase()}
        {count > 0 && (
          <span data-testid="unread-count" className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div role="region" aria-label="Notifications" className="absolute right-0 top-full z-30 mt-2 w-[min(calc(100vw-2rem),22rem)] rounded-md border-[1.5px] border-ink bg-surface text-sm shadow-lg">
          <p className="border-b border-border px-3 py-2 font-semibold">Notifications</p>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-muted">Nothing yet. News from your causes will show up here.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.url} onClick={() => setOpen(false)} className={`block px-3 py-2 hover:bg-border/40 ${n.unread ? "bg-mustard/15" : ""}`}>
                    <span className="block font-medium">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-muted">{n.body}</span>}
                    <span className="block text-xs text-muted">
                      <RelativeTime iso={n.createdAt} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/me" onClick={() => setOpen(false)} className="block border-t border-border px-3 py-2 font-medium text-link hover:bg-border/40">
            Your activity and all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
