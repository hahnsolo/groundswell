"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** About · Chat · Events, under a cause's header. */
export function CauseTabs({ id, chatLocked, messages, events }: { id: string; chatLocked: boolean; messages: number; events: number }) {
  const path = usePathname();
  const base = `/issues/${id}`;
  const tabs = [
    { href: base, label: "About" },
    { href: `${base}/chat`, label: "Chat", extra: chatLocked ? "🔒" : messages > 0 ? String(messages) : null },
    { href: `${base}/events`, label: "Events", extra: events > 0 ? String(events) : null },
  ];
  return (
    <nav aria-label="Cause sections" className="mt-6 flex gap-6 border-b-[1.5px] border-ink">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-[1.5px] border-b-[3px] pb-2 text-sm ${active ? "border-brand font-semibold" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
            {t.extra && <span className="ml-1.5 text-xs text-muted">{t.extra}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
