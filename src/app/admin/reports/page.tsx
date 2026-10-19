import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderate, restore } from "@/app/actions/admin";
import { RelativeTime } from "@/components/local-time";
import { buttonStyles, inputStyles } from "@/components/styles";
import { displayName } from "@/lib/accounts";
import { MAX_REMOVAL_REASON, permanentDeletionDate, purgeCutoff, REMOVAL_RETENTION_DAYS } from "@/lib/moderation";

// No title: the static shell shouldn't hint at what this page is.
export const metadata: Metadata = { robots: { index: false } };

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Everything, including the heading, waits on the admin check so the
          page reveals nothing to non-admins. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-border/60" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

type Target = {
  type: "issue" | "comment";
  id: string;
  reports: { reason: string; createdAt: Date; reporter: string }[];
};

async function Queue() {
  await requireAdmin();
  const reports = await db.report.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "asc" },
    include: { reporter: { select: { name: true } } },
    take: 500,
  });

  // Group reports by the content they point at.
  const targets = new Map<string, Target>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const t = targets.get(key) ?? { type: r.targetType as Target["type"], id: r.targetId, reports: [] };
    t.reports.push({ reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name });
    targets.set(key, t);
  }
  const list = [...targets.values()].sort((a, b) => b.reports.length - a.reports.length);

  const ids = (type: Target["type"]) => list.filter((t) => t.type === type).map((t) => t.id);
  const [issues, comments] = await Promise.all([loadIssues(ids("issue")), loadComments(ids("comment"))]);
  const issueById = new Map(issues.map((i) => [i.id, i]));
  const commentById = new Map(comments.map((c) => [c.id, c]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Moderation queue</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Content reported by the community. Items with 3+ reports are already hidden until you decide.
      </p>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted">All clear â€” nothing to review.</p>
      ) : (
        <QueueList list={list} issueById={issueById} commentById={commentById} />
      )}
      <RecentlyRemoved />
    </>
  );
}

async function RecentlyRemoved() {
  const where = { removedAt: { gt: purgeCutoff() } };
  const author = { select: { name: true, email: true, deactivatedAt: true } };
  const [issues, comments] = await Promise.all([
    db.issue.findMany({ where, include: { author }, orderBy: { removedAt: "desc" }, take: 100 }),
    db.comment.findMany({
      where,
      include: { author, issue: { select: { id: true, title: true } } },
      orderBy: { removedAt: "desc" },
      take: 100,
    }),
  ]);
  const items = [
    ...issues.map((i) => ({ ...i, type: "issue" as const, text: i.title, on: null })),
    ...comments.map((c) => ({ ...c, type: "comment" as const, text: c.body, on: c.issue })),
  ].sort((a, b) => b.removedAt!.getTime() - a.removedAt!.getTime());

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight">Recently removed</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Removed content is only visible to its author, and is deleted for good {REMOVAL_RETENTION_DAYS} days after removal. Until
        then you can restore it.
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">Nothing removed recently.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded bg-border px-1.5 py-0.5 uppercase text-foreground">{item.type}</span>
                <span>
                  removed <RelativeTime iso={item.removedAt!.toISOString()} />
                </span>
                <span>Â· deleted for good <RelativeTime iso={permanentDeletionDate(item.removedAt!).toISOString()} /></span>
              </div>
              {item.on && <p className="mt-2 text-xs text-muted">on {item.on.title}</p>}
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{item.text}</p>
              <p className="mt-1 text-xs text-muted">
                by {displayName(item.author)} ({item.author.email})
                {item.removalReason && <> Â· reason: â€œ{item.removalReason}â€</>}
              </p>
              <form action={restore} className="mt-3">
                <input type="hidden" name="targetType" value={item.type} />
                <input type="hidden" name="targetId" value={item.id} />
                <button className={buttonStyles.secondary}>Restore {item.type}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type IssueRow = Awaited<ReturnType<typeof loadIssues>>[number];
type CommentRow = Awaited<ReturnType<typeof loadComments>>[number];

function loadIssues(ids: string[]) {
  return db.issue.findMany({ where: { id: { in: ids } }, include: { author: { select: { name: true, email: true, deactivatedAt: true } } } });
}

function loadComments(ids: string[]) {
  return db.comment.findMany({
    where: { id: { in: ids } },
    include: { author: { select: { name: true, email: true, deactivatedAt: true } }, issue: { select: { id: true, title: true } } },
  });
}

function QueueList({
  list,
  issueById,
  commentById,
}: {
  list: Target[];
  issueById: Map<string, IssueRow>;
  commentById: Map<string, CommentRow>;
}) {
  return (
    <ul className="space-y-4">
      {list.map((t) => {
        const issue = t.type === "issue" ? issueById.get(t.id) : undefined;
        const comment = t.type === "comment" ? commentById.get(t.id) : undefined;
        const content = issue ?? comment;
        const reasons = t.reports.map((r) => r.reason).filter(Boolean);
        return (
          <li key={`${t.type}:${t.id}`} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-border px-1.5 py-0.5 uppercase">{t.type}</span>
              <span className="font-medium text-red-700 dark:text-red-400">
                {t.reports.length} report{t.reports.length === 1 ? "" : "s"}
              </span>
              {content?.hidden && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Hidden</span>}
              <span className="text-muted">
                first reported <RelativeTime iso={t.reports[0].createdAt.toISOString()} />
              </span>
            </div>

            {!content ? (
              <p className="mt-3 text-sm text-muted">This content no longer exists.</p>
            ) : (
              <div className="mt-3 space-y-1">
                {issue && (
                  <Link href={`/issues/${issue.id}`} className="font-semibold hover:underline">
                    {issue.title}
                  </Link>
                )}
                {comment && (
                  <p className="text-xs text-muted">
                    on{" "}
                    <Link href={`/issues/${comment.issue.id}`} className="underline">
                      {comment.issue.title}
                    </Link>
                  </p>
                )}
                <p className="line-clamp-4 whitespace-pre-line text-sm">{issue?.description ?? comment?.body}</p>
                <p className="text-xs text-muted">
                  by {displayName(content.author)} ({content.author.email})
                </p>
              </div>
            )}

            {reasons.length > 0 && (
              <ul className="mt-3 space-y-1 border-l-2 border-border pl-3 text-xs text-muted">
                {reasons.map((r, i) => (
                  <li key={i}>â€œ{r}â€</li>
                ))}
              </ul>
            )}

            <form action={moderate} className="mt-4 space-y-2">
              <input type="hidden" name="targetType" value={t.type} />
              <input type="hidden" name="targetId" value={t.id} />
              {content && (
                <input
                  name="reason"
                  maxLength={MAX_REMOVAL_REASON}
                  placeholder="Reason for removing (optional, shown to the author)"
                  aria-label="Reason for removing"
                  className={inputStyles}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button name="decision" value="kept" className={buttonStyles.secondary}>
                  {content?.hidden ? "Restore" : "Keep"} &amp; dismiss reports
                </button>
                {content && (
                  <button name="decision" value="removed" className={`${buttonStyles.secondary} text-red-700 dark:text-red-400`}>
                    Remove {t.type}
                  </button>
                )}
              </div>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
