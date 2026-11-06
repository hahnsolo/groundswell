"use client";

import { useState } from "react";
import { listMembers, type MemberFilter, type MemberRow, type MemberSort } from "@/lib/member-list";
import { LocalTime } from "./local-time";
import { RemoveMemberForm } from "./remove-member";

// The leaders' Members list (#79): who's joined, when, whether they've signed
// and are coming, and how they found the cause. Never emails.

export function MemberList({ causeId, rows, askLabel, eventTitle }: { causeId: string; rows: MemberRow[]; askLabel: string | null; eventTitle: string | null }) {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [sort, setSort] = useState<MemberSort>("newest");
  const shown = listMembers(rows, filter, sort);
  const select = "rounded-md border border-border bg-surface px-2 py-1 text-xs";

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Sort members" value={sort} onChange={(e) => setSort(e.target.value as MemberSort)} className={select}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <select aria-label="Filter members" value={filter} onChange={(e) => setFilter(e.target.value as MemberFilter)} className={select}>
          <option value="all">Everyone ({rows.length})</option>
          {askLabel && <option value="not_signed">Hasn&apos;t signed</option>}
          {eventTitle && <option value="not_going">Not going</option>}
        </select>
      </div>
      {askLabel && <p className="text-xs text-muted">Signed means the latest ask: {askLabel}</p>}
      {eventTitle && <p className="text-xs text-muted">Going means the next event: {eventTitle}</p>}
      <ul className="divide-y divide-border rounded-md border border-border" aria-label="Members">
        {shown.map((m) => (
          <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-2">
            <span className="min-w-0">
              <span className="font-medium">{m.name}</span>
              {m.role && <span className="text-muted"> · {m.role} this</span>}
              {m.hidden && <span className="text-xs text-muted"> · shows as &ldquo;a neighbour&rdquo; to others</span>}
              <span className="block text-xs text-muted">
                Joined <LocalTime iso={m.joinedAt} options={{ month: "short", day: "numeric", year: "numeric" }} />
                {m.from && ` · ${m.from}`}
              </span>
            </span>
            <span className="flex shrink-0 gap-2 text-xs">
              {askLabel && <span className={m.signed ? "" : "text-muted"}>{m.signed ? "✓ Signed" : "Not signed"}</span>}
              {eventTitle && <span className={m.going ? "" : "text-muted"}>{m.going ? "✓ Going" : "Not going"}</span>}
            </span>
            {m.removable && (
              <details className="w-full text-xs">
                <summary className="cursor-pointer text-muted hover:text-foreground">Remove from this cause</summary>
                <div className="mt-2">
                  <RemoveMemberForm causeId={causeId} userId={m.id} name={m.name} />
                </div>
              </details>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="p-3 text-center text-muted">Nobody here. Everyone&apos;s covered.</li>}
      </ul>
      <p className="text-xs text-muted">Only the people leading this cause see this list. Emails are never shown.</p>
    </div>
  );
}
