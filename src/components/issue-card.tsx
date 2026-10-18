import Link from "next/link";
import { getCategory, getStatus } from "@/lib/categories";
import type { NearbyIssue } from "@/lib/queries";
import { RelativeTime } from "./local-time";

export function IssueCard({ issue }: { issue: NearbyIssue }) {
  const cat = getCategory(issue.category);
  const status = getStatus(issue.status);
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="group flex gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-brand/50 hover:shadow-sm"
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-soft py-2 text-brand-strong dark:text-brand">
        <span className="text-lg font-semibold leading-none">{issue._count.supports}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wide">care</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {cat.emoji} {cat.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>{status.label}</span>
        </div>
        <h3 className="mt-1 font-semibold group-hover:text-brand-strong dark:group-hover:text-brand">{issue.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{issue.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            {issue.placeName} · {issue.distanceKm < 1 ? "<1" : Math.round(issue.distanceKm)} km away
          </span>
          <span>💬 {issue._count.comments}</span>
          {issue._count.meetups > 0 && <span>📅 {issue._count.meetups} meetup{issue._count.meetups > 1 ? "s" : ""}</span>}
          <RelativeTime iso={issue.createdAt.toISOString()} />
        </div>
      </div>
    </Link>
  );
}
